import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import {
  analyzeWritingSamples,
  buildPrecedentIndex,
  chunkPrecedentDocument,
  compileDraftPrompt,
  computeLineDiff,
  DEFAULT_PRECEDENTS,
  DEFAULT_VOICE_PROFILE,
  DEFAULT_WRITING_SAMPLES,
  extractTextFromDocxBytes,
  isLoopbackHostname,
  rankPrecedents,
  selectVoiceSamples,
  splitSubjectAndBody,
} from '@drafter/shared';

test('chunkPrecedentDocument preserves section headings and respects boundaries', () => {
  const doc = {
    id: 'doc-1',
    title: 'Master Services Policy',
    category: 'Legal',
    tags: ['msa', 'sla'],
    whenToUse: 'MSA terms',
    guidance: 'Keep liability capped.',
    body: [
      '# Liability Cap',
      'Standard liability is capped at twelve months of fees paid.',
      '',
      'Exceptions require general counsel written approval.',
      '',
      '# Payment Terms',
      'Invoices are due Net 30 from receipt via ACH or wire.',
      '',
      'Late balances accrue 1.5% monthly interest after written notice.',
    ].join('\n'),
    enabled: true,
    pinned: false,
    updatedAt: '2026-11-12T00:00:00.000Z',
  };

  const chunks = chunkPrecedentDocument(doc, { maxChunkChars: 130 });
  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0].heading, 'Liability Cap');
  assert.ok(chunks.some((c) => c.heading === 'Payment Terms'));
  for (const chunk of chunks) {
    assert.ok(chunk.text.startsWith(`${chunk.heading}\n`));
  }
});

test('rankPrecedents ranks relevant precedent first and honors pin/exclude rules', () => {
  const query =
    'Customer asking for a 25% discount on their annual SaaS renewal';
  const ranked = rankPrecedents(DEFAULT_PRECEDENTS, query);
  assert.ok(ranked.length >= 1);
  assert.equal(ranked[0].document.id, 'prec-renewal-discount');
  assert.ok(ranked[0].score >= 50);

  // Pin vendor escalation so it rises to top, and exclude renewal policy
  const overridden = rankPrecedents(DEFAULT_PRECEDENTS, query, {
    pinnedIds: ['prec-vendor-sla'],
    excludedIds: ['prec-renewal-discount'],
  });
  assert.equal(overridden[0].document.id, 'prec-vendor-sla');
  assert.equal(overridden[0].pinned, true);
  assert.ok(
    !overridden.some((item) => item.document.id === 'prec-renewal-discount')
  );
});

test('rankPrecedents inverted index scales across 250 documents under 50ms', () => {
  const docs = Array.from({ length: 250 }, (_, idx) => ({
    id: `prec-${idx}`,
    title:
      idx === 173
        ? 'Enterprise Security SOC2 Addendum & Data Residency Policy'
        : `Operational Guideline #${idx}`,
    category: idx % 2 === 0 ? 'Operations' : 'Commercial',
    tags: idx === 173 ? ['soc2', 'security', 'residency', 'audit'] : [`tag${idx}`, 'general'],
    whenToUse:
      idx === 173
        ? 'When an enterprise buyer asks about SOC2 reports or EU data residency'
        : `General guideline for internal workflow ${idx}`,
    guidance: `Follow section ${idx} rules carefully.`,
    body:
      idx === 173
        ? '# Security Controls\nProvide SOC2 Type II summary under NDA and confirm EU Frankfurt hosting.'
        : `Standard operating procedure block ${idx} covering routine internal triage and scheduling.`,
    enabled: true,
    pinned: false,
    updatedAt: '2026-11-12T00:00:00.000Z',
  }));

  const index = buildPrecedentIndex(docs);
  const start = performance.now();
  const results = rankPrecedents(
    docs,
    'Buyer asking for SOC2 Type II audit report and EU data residency',
    { index, limit: 5 }
  );
  const elapsedMs = performance.now() - start;

  assert.equal(results[0].document.id, 'prec-173');
  assert.ok(elapsedMs < 50, `Expected <50ms, took ${elapsedMs.toFixed(2)}ms`);
});

test('analyzeWritingSamples and selectVoiceSamples capture style metrics and match tone', () => {
  const analysis = analyzeWritingSamples(DEFAULT_WRITING_SAMPLES);
  assert.equal(analysis.activeCount, 2);
  assert.ok(analysis.totalWords > 100);
  assert.ok(analysis.avgSentenceLength > 5);
  assert.ok(analysis.contractionRate > 0);
  assert.ok(analysis.commonOpenings.some((o) => /Maya/i.test(o)));
  assert.ok(analysis.commonClosings.includes('Best'));

  const selected = selectVoiceSamples(
    DEFAULT_WRITING_SAMPLES,
    'Warm client scope alignment email',
    1
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, 'voice-warm-client');
});

test('compileDraftPrompt, splitSubjectAndBody, and computeLineDiff behave deterministically', () => {
  const compiled = compileDraftPrompt({
    context: {
      kind: 'email',
      title: 'Webmail',
      subject: 'Annual SaaS Renewal & Discount Request',
      recipient: 'buyer@acme.example',
      threadText: 'Can you give us a 25% discount to renew for 12 months?',
      url: 'http://127.0.0.1:4318/webmail',
      hostname: '127.0.0.1',
      capturedAt: '2026-11-12T00:00:00.000Z',
    },
    intent: 'Email Reply',
    instruction: 'Decline 25% discount and offer 10% for 24-month commitment.',
    precedents: DEFAULT_PRECEDENTS,
    writingSamples: DEFAULT_WRITING_SAMPLES,
    voiceProfile: DEFAULT_VOICE_PROFILE,
  });

  assert.ok(compiled.systemPrompt.includes('=== PERSONAL VOICE & STYLE ==='));
  assert.ok(compiled.systemPrompt.includes('SaaS Annual Renewal'));
  assert.ok(compiled.userPrompt.includes('buyer@acme.example'));
  assert.equal(compiled.appliedPrecedents[0].document.id, 'prec-renewal-discount');

  const split = splitSubjectAndBody(
    'Subject: Re: Annual SaaS Renewal\n\nHi there,\n\nThanks for reaching out.'
  );
  assert.equal(split.subject, 'Re: Annual SaaS Renewal');
  assert.equal(split.body, 'Hi there,\n\nThanks for reaching out.');

  const diff = computeLineDiff('Line A\nLine B\nLine C', 'Line A\nLine B2\nLine C');
  assert.deepEqual(diff, [
    { type: 'unchanged', text: 'Line A' },
    { type: 'removed', text: 'Line B' },
    { type: 'added', text: 'Line B2' },
    { type: 'unchanged', text: 'Line C' },
  ]);
});

test('isLoopbackHostname strictly checks URL hostname without substring bypass', () => {
  assert.equal(isLoopbackHostname('http://localhost:4318'), true);
  assert.equal(isLoopbackHostname('http://127.0.0.1:11434'), true);
  assert.equal(isLoopbackHostname('https://[::1]:8080/path'), true);
  assert.equal(isLoopbackHostname('http://localhost.evil.com'), false);
  assert.equal(isLoopbackHostname('https://evil.com/localhost'), false);
  assert.equal(isLoopbackHostname('http://user:pass@127.0.0.1:4318'), false);
  assert.equal(isLoopbackHostname('javascript:localhost'), false);
  assert.equal(isLoopbackHostname(''), false);
});

test('extractTextFromDocxBytes parses DOCX XML paragraphs cleanly', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>First clause &amp; scope</w:t></w:r></w:p>
    <w:p><w:r><w:t>Second paragraph</w:t><w:br/><w:t>continued line</w:t></w:r></w:p>
  </w:body>
</w:document>`;
  const bytes = zipSync({
    'word/document.xml': strToU8(xml),
  });

  const text = extractTextFromDocxBytes(bytes);
  assert.equal(text, 'First clause & scope\n\nSecond paragraph\ncontinued line');
});
