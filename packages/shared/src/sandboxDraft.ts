export interface SandboxDraftParams {
  subject: string;
  recipient?: string;
  instruction: string;
  intent: string;
  model?: string;
  refinement?: string;
  previousDraft?: string;
  authorName?: string;
  preferredGreeting?: string;
  preferredSignOff?: string;
  signatureBlock?: string;
  appliedPrecedentTitles: string[];
  appliedPrecedentGuidance?: string[];
  footerNote?: string;
}

function deriveRecipientFirstName(recipient?: string): string {
  const raw = (recipient ?? '').trim();
  if (!raw) return 'there';
  const beforeAt = raw.includes('@') ? raw.split('@')[0] : raw;
  const firstToken = beforeAt
    .split(/[._\-\s]+/)
    .find((part) => part.length > 0 && !/^(buyer|info|team|sales|support|admin|hello|contact|account)$/i.test(part));
  if (!firstToken) return 'there';
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1).toLowerCase();
}

function formatGreeting(preferredGreeting: string | undefined, recipient?: string): string {
  const name = deriveRecipientFirstName(recipient);
  const template = (preferredGreeting ?? '').trim();
  if (!template) return `Hi ${name},`;
  if (template.includes('{{name}}')) {
    return template.replace(/\{\{name\}\}/g, name);
  }
  return template;
}

function formatClosing(
  preferredSignOff: string | undefined,
  authorName: string,
  warmOverride: boolean,
  signatureBlock?: string,
  footerNote?: string
): string {
  const cleanAuthor = authorName.trim() || 'Alex';
  let signOffLines: string[];

  if (warmOverride) {
    signOffLines = ['Warmly,', cleanAuthor];
  } else if (preferredSignOff && preferredSignOff.trim()) {
    signOffLines = preferredSignOff
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
  } else {
    signOffLines = ['Best,', cleanAuthor];
  }

  if (footerNote && signOffLines.length > 0) {
    signOffLines[signOffLines.length - 1] = `${signOffLines[signOffLines.length - 1]} (${footerNote})`;
  }

  if (signatureBlock && signatureBlock.trim()) {
    signOffLines.push(signatureBlock.trim());
  }

  return signOffLines.join('\n');
}

function buildCleanSubject(subject: string, intent: string, instruction: string): string {
  const trimmed = subject.trim();
  if (trimmed) {
    if (
      intent === 'Cold Outreach' ||
      intent === 'Status Update' ||
      intent === 'Web Form / Comment' ||
      /^re:/i.test(trimmed)
    ) {
      return trimmed;
    }
    return `Re: ${trimmed}`;
  }
  const snippet = instruction.trim().replace(/\s+/g, ' ').slice(0, 56);
  return snippet ? `Follow-up: ${snippet}` : 'Follow-up on next steps';
}

export function buildSandboxDraft(params: SandboxDraftParams): string {
  const cleanSubject = buildCleanSubject(
    params.subject,
    params.intent,
    params.instruction
  );
  const greeting = formatGreeting(params.preferredGreeting, params.recipient);
  const author = params.authorName?.trim() || 'Alex';
  const cleanTopic =
    cleanSubject.replace(/^(Re:|Follow-up:)\s*/i, '').trim() || 'your note';
  const rawTask = (params.instruction.trim() || 'next steps').replace(/[.!?]+$/, '');
  const inlineTask =
    /^[A-Z][a-z]/.test(rawTask)
      ? rawTask.charAt(0).toLowerCase() + rawTask.slice(1)
      : rawTask;
  const combinedSignal = `${params.subject} ${params.instruction} ${params.appliedPrecedentTitles.join(' ')}`.toLowerCase();
  const isRenewalDiscount =
    combinedSignal.includes('discount') ||
    combinedSignal.includes('renewal') ||
    combinedSignal.includes('25%');

  const modelLower = (params.model ?? '').toLowerCase();
  const isAltModel =
    modelLower.includes('gpt') ||
    modelLower.includes('gemini') ||
    modelLower.includes('grok');

  const refLower = (params.refinement ?? '').toLowerCase();
  const isShorter = refLower.includes('shorter') || refLower.includes('concise') || refLower.includes('punchier');
  const isWarmer = refLower.includes('warmer');
  const isPrecedentFocus = refLower.includes('precedent');

  const closing = formatClosing(
    params.preferredSignOff,
    author,
    isWarmer,
    params.signatureBlock,
    params.footerNote
  );

  if (params.refinement && params.previousDraft) {
    if (isShorter) {
      const bodyCore = isRenewalDiscount
        ? 'Per our renewal guidelines, we cannot discount single-year terms by 25%, though we can extend a 10% loyalty credit for a 24-month commitment paid upfront.'
        : `To keep this brief regarding ${cleanTopic}: we're aligned on next steps (${inlineTask})${params.appliedPrecedentTitles.length ? ` per ${params.appliedPrecedentTitles[0]}` : ''}.`;
      return [
        `Subject: ${cleanSubject}`,
        '',
        greeting,
        '',
        `Thanks for the note on ${cleanTopic} — keeping this concise:`,
        '',
        bodyCore,
        '',
        'Does Thursday at 2:00 PM work for a quick 15-minute alignment call?',
        '',
        closing,
      ].join('\n');
    }

    if (isWarmer) {
      const bodyCore = isRenewalDiscount
        ? 'While our single-year pricing stays at standard rates to reflect platform capabilities and dedicated SLAs, we would love to offer a 10% loyalty credit on a 24-month upfront commitment.'
        : `We value our partnership and appreciate your flexibility around ${cleanTopic} (${inlineTask}). We want to make sure the next milestone feels smooth and well-supported for your team.`;
      return [
        `Subject: ${cleanSubject}`,
        '',
        greeting,
        '',
        `Really appreciate the partnership and your note regarding ${cleanTopic}.`,
        '',
        bodyCore,
        '',
        'Would Thursday afternoon work for a quick 15-minute call to walk through options?',
        '',
        closing,
      ].join('\n');
    }

    if (isPrecedentFocus && params.appliedPrecedentTitles.length > 0) {
      const guardrails = (params.appliedPrecedentGuidance ?? []).filter(Boolean);
      return [
        `Subject: ${cleanSubject}`,
        '',
        greeting,
        '',
        `Following up directly against our ${params.appliedPrecedentTitles.join(' & ')} commitments:`,
        '',
        isRenewalDiscount
          ? '1. Single-year terms remain at list pricing.\n2. We can apply a 10% loyalty credit for a 24-month commitment paid annually upfront.\n3. Please confirm your preferred path at least 10 business days before the renewal date.'
          : guardrails.length > 0
            ? guardrails.map((g, idx) => `${idx + 1}. ${g}`).join('\n')
            : `We will align deliverables strictly with ${params.appliedPrecedentTitles[0]} and confirm milestones in writing.`,
        '',
        `Action summary: ${rawTask}.`,
        '',
        closing,
      ].join('\n');
    }

    return [
      `Subject: ${cleanSubject}`,
      '',
      greeting,
      '',
      `Refined update (${params.refinement}):`,
      '',
      isRenewalDiscount
        ? `Following up on ${cleanTopic}, we cannot offer a 25% single-year discount, though we can provide a 10% loyalty credit on a 24-month upfront term${params.appliedPrecedentTitles.length ? ` (${params.appliedPrecedentTitles.join(', ')})` : ''}.`
        : `Following up on ${cleanTopic}, we are aligned on next steps (${inlineTask})${params.appliedPrecedentTitles.length ? ` per ${params.appliedPrecedentTitles.join(', ')}` : ''}.`,
      '',
      'Let me know if Thursday afternoon works for a brief alignment call.',
      '',
      closing,
    ].join('\n');
  }

  if (isRenewalDiscount) {
    const firstPara = isAltModel
      ? `Thanks for sending over your note on ${cleanTopic}. Looking at your renewal request:`
      : `Thanks for reaching out regarding ${cleanTopic}.`;
    const corePara = isAltModel
      ? 'We keep 12-month renewals at standard rates to reflect expanded platform capabilities and SLAs, though we can extend a 10% loyalty credit if you lock in a 24-month commitment paid upfront.'
      : 'Aligned with our prior precedent commitments, we cannot approve a 25% discount on a single-year term, though we can offer a 10% loyalty credit on a 24-month commitment paid upfront (or keep a 1-year term at list with 2 complimentary onboarding seats).';

    return [
      `Subject: ${cleanSubject}`,
      '',
      greeting,
      '',
      firstPara,
      '',
      corePara,
      '',
      'Let me know if Thursday at 2:00 PM works for a quick 15-minute alignment call.',
      '',
      closing,
    ].join('\n');
  }

  const precedentClause =
    params.appliedPrecedentTitles.length > 0
      ? `Following ${params.appliedPrecedentTitles.join(' & ')}, `
      : '';
  const guidanceLine = (params.appliedPrecedentGuidance ?? []).find(Boolean);

  const opener =
    params.intent === 'Cold Outreach'
      ? `Reaching out regarding ${cleanTopic} — ${inlineTask}.`
      : params.intent === 'Status Update'
        ? `Quick update on ${cleanTopic}: here is where things stand.`
        : `Thanks for the note on ${cleanTopic}.`;

  const actionBlock = isAltModel
    ? [
        `${precedentClause}here is our proposed path forward:`,
        `1. ${rawTask}.`,
        guidanceLine
          ? `2. Key guardrail: ${guidanceLine}`
          : '2. Confirm owners and target dates so both teams stay aligned.',
      ].join('\n')
    : `${precedentClause}${precedentClause ? inlineTask : rawTask}.${guidanceLine ? ` (${guidanceLine})` : ''}`;

  return [
    `Subject: ${cleanSubject}`,
    '',
    greeting,
    '',
    opener,
    '',
    actionBlock,
    '',
    'Let me know if Thursday afternoon works for a brief check-in to finalize next steps.',
    '',
    closing,
  ].join('\n');
}
