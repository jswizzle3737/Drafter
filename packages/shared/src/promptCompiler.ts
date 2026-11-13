import { rankPrecedents } from './precedentEngine.js';
import { analyzeWritingSamples, selectVoiceSamples } from './voiceEngine.js';
import type {
  CompiledDraftPrompt,
  DiffLine,
  DraftIntent,
  PageContext,
  PrecedentDocument,
  VoiceProfile,
  WritingSample,
} from './types.js';

export interface CompileDraftPromptInput {
  context: PageContext;
  intent: DraftIntent;
  instruction: string;
  precedents: PrecedentDocument[];
  pinnedPrecedentIds?: string[];
  excludedPrecedentIds?: string[];
  writingSamples: WritingSample[];
  voiceProfile: VoiceProfile;
  voiceToneOverride?: string;
  previousDraft?: string;
  refinementInstruction?: string;
  maxPrecedents?: number;
  minPrecedentScore?: number;
  maxVoiceSamples?: number;
}

const DIMENSION_LABELS = {
  formality: ['Very Casual', 'Casual', 'Balanced', 'Formal', 'Highly Formal'],
  directness: ['Gentle', 'Diplomatic', 'Balanced', 'Direct', 'Blunt'],
  warmth: ['Reserved', 'Matter-of-fact', 'Balanced', 'Warm', 'Very Warm'],
  conciseness: ['Detailed', 'Thorough', 'Balanced', 'Concise', 'Ultra-brief'],
};

function describeDimension(
  key: keyof typeof DIMENSION_LABELS,
  value: number
): string {
  const clamped = Math.min(5, Math.max(1, Math.round(value)));
  return `${DIMENSION_LABELS[key][clamped - 1]} (${clamped}/5)`;
}

export function compileDraftPrompt(
  input: CompileDraftPromptInput
): CompiledDraftPrompt {
  const querySignal = [
    input.context.subject,
    input.context.threadText,
    input.intent,
    input.instruction,
    input.refinementInstruction ?? '',
  ]
    .filter(Boolean)
    .join('\n');

  const appliedPrecedents = rankPrecedents(input.precedents, querySignal, {
    pinnedIds: input.pinnedPrecedentIds,
    excludedIds: input.excludedPrecedentIds,
    limit: input.maxPrecedents ?? 4,
    minScore: input.minPrecedentScore ?? 15,
  });

  const voiceAnalysis = analyzeWritingSamples(input.writingSamples);
  const attachedVoiceSamples = selectVoiceSamples(
    input.writingSamples,
    `${input.intent} ${input.voiceToneOverride ?? ''} ${input.instruction} ${input.context.subject}`,
    input.maxVoiceSamples ?? 3
  );

  const vp = input.voiceProfile;
  const effectiveTone =
    input.voiceToneOverride && input.voiceToneOverride !== 'Personal Default'
      ? input.voiceToneOverride
      : vp.defaultTonePreset;

  const systemLines: string[] = [
    'You are Drafter, an executive AI writing partner.',
    'Write ready-to-send drafts that strictly follow applicable precedent policies/commitments and match the user’s authentic writing voice.',
    'Output format: Start with a single `Subject: <concise subject line>` line when drafting an email or threaded message, followed by a blank line and the body text. Do not wrap the response in markdown code fences.',
    '',
    '=== PERSONAL VOICE & STYLE ===',
    `Author Name: ${vp.displayName || 'Author'}`,
    vp.roleContext ? `Role/Context: ${vp.roleContext}` : '',
    `Tone Preset: ${effectiveTone}`,
    `Voice Dimensions: Formality=${describeDimension('formality', vp.dimensions.formality)}, Directness=${describeDimension('directness', vp.dimensions.directness)}, Warmth=${describeDimension('warmth', vp.dimensions.warmth)}, Conciseness=${describeDimension('conciseness', vp.dimensions.conciseness)}`,
    vp.preferredGreeting ? `Preferred Greeting: ${vp.preferredGreeting}` : '',
    vp.preferredSignOff ? `Preferred Sign-Off:\n${vp.preferredSignOff}` : '',
    vp.signatureBlock ? `Signature Block:\n${vp.signatureBlock}` : '',
    vp.guidanceRules ? `Writing Guidance Rules:\n${vp.guidanceRules}` : '',
    `Stylometric Fingerprint: ${voiceAnalysis.summary}`,
  ].filter(Boolean);

  if (attachedVoiceSamples.length > 0) {
    systemLines.push('', '=== REFERENCE VOICE EXAMPLES ===');
    for (const sample of attachedVoiceSamples) {
      systemLines.push(
        `--- Sample: ${sample.title} [${sample.contextTag || 'General'}] ---`,
        sample.content.trim()
      );
    }
  }

  if (appliedPrecedents.length > 0) {
    systemLines.push('', '=== RELEVANT PRECEDENTS & GUARDRAILS ===');
    for (const item of appliedPrecedents) {
      const doc = item.document;
      systemLines.push(
        `--- Precedent: ${doc.title} (${item.score}% match${item.pinned ? ', PINNED' : ''}) ---`,
        doc.whenToUse ? `When to Apply: ${doc.whenToUse}` : '',
        doc.guidance ? `Guardrail / Guidance: ${doc.guidance}` : '',
        `Content:\n${item.bestChunk?.text || doc.body.trim()}`
      );
    }
  }

  const userLines: string[] = [
    `Intent: ${input.intent}`,
    input.context.subject ? `Context Subject: ${input.context.subject}` : '',
    input.context.recipient
      ? `Recipient / Counterparty: ${input.context.recipient}`
      : '',
    input.context.hostname ? `Source Host: ${input.context.hostname}` : '',
    input.context.threadText
      ? `Incoming Context / Message:\n${input.context.threadText.trim()}`
      : '',
    '',
    `Drafting Instruction:\n${input.instruction.trim() || `Draft a clear ${input.intent.toLowerCase()} response.`}`,
  ].filter((l) => l !== '');

  if (input.previousDraft && input.refinementInstruction) {
    userLines.push(
      '',
      '=== PREVIOUS DRAFT ===',
      input.previousDraft.trim(),
      '',
      `=== REFINEMENT INSTRUCTION ===\n${input.refinementInstruction.trim()}`
    );
  }

  const systemPrompt = systemLines.join('\n');
  const userPrompt = userLines.join('\n');

  return {
    systemPrompt,
    userPrompt,
    fullText: `[SYSTEM]\n${systemPrompt}\n\n[USER]\n${userPrompt}`,
    appliedPrecedents,
    attachedVoiceSamples,
    voiceAnalysis,
  };
}

/**
 * Splits a generated draft into `{ subject, body }` cleanly.
 */
export function splitSubjectAndBody(
  rawText: string,
  fallbackSubject = ''
): { subject: string; body: string } {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');
  if (lines.length > 0) {
    const subjMatch = lines[0].match(/^(?:\*\*)?Subject(?:\*\*)?:\s*(.+)$/i);
    if (subjMatch) {
      const subject = subjMatch[1].trim();
      const rest = lines.slice(1).join('\n').replace(/^\n+/, '').trim();
      return { subject, body: rest };
    }
  }
  return { subject: fallbackSubject.trim(), body: normalized };
}

/**
 * Computes a deterministic line-by-line diff using Longest Common Subsequence.
 */
export function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const a = oldText.replace(/\r\n/g, '\n').split('\n');
  const b = newText.replace(/\r\n/g, '\n').split('\n');
  const m = a.length;
  const n = b.length;

  const dp: Uint32Array[] = Array.from(
    { length: m + 1 },
    () => new Uint32Array(n + 1)
  );

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = dp[i + 1][j] >= dp[i][j + 1] ? dp[i + 1][j] : dp[i][j + 1];
      }
    }
  }

  const diff: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      diff.push({ type: 'unchanged', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      diff.push({ type: 'removed', text: a[i] });
      i++;
    } else {
      diff.push({ type: 'added', text: b[j] });
      j++;
    }
  }
  while (i < m) {
    diff.push({ type: 'removed', text: a[i++] });
  }
  while (j < n) {
    diff.push({ type: 'added', text: b[j++] });
  }
  return diff;
}
