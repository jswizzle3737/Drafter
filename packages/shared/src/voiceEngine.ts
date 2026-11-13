import { tokenizeText } from './precedentEngine.js';
import type { VoiceAnalysis, WritingSample } from './types.js';

const CONTRACTIONS_RE =
  /\b(?:i'm|i've|i'll|i'd|we're|we've|we'll|we'd|you're|you've|you'll|you'd|they're|they've|it's|that's|there's|here's|what's|who's|can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|hasn't|haven't|couldn't|wouldn't|shouldn't|let's)\b/gi;

const OPENING_RE =
  /^(hi\s+[a-z]+|hey\s+[a-z]+|hello\s+[a-z]+|dear\s+[a-z]+|hi\s+team|hey\s+team|good\s+(?:morning|afternoon|evening))/i;

const CLOSING_RE =
  /^(best|thanks|thank\s+you|warmly|sincerely|regards|best\s+regards|kind\s+regards|cheers|talk\s+soon)\b/i;

export function analyzeWritingSamples(samples: WritingSample[]): VoiceAnalysis {
  const active = samples.filter((s) => s.active && s.content.trim().length > 0);
  if (active.length === 0) {
    return {
      activeCount: 0,
      totalWords: 0,
      avgSentenceLength: 0,
      contractionRate: 0,
      questionRate: 0,
      commonOpenings: [],
      commonClosings: [],
      summary:
        'No active writing samples yet. Paste or upload 2-5 past emails or memos to build your Personal Voice Fingerprint.',
    };
  }

  let totalWords = 0;
  let totalSentences = 0;
  let totalQuestions = 0;
  let totalContractions = 0;
  const openings: string[] = [];
  const closings: string[] = [];

  for (const sample of active) {
    const text = sample.content.replace(/\r\n/g, '\n').trim();
    const words = text.match(/\S+/g) ?? [];
    totalWords += words.length;

    const sentences = text
      .split(/(?<=[.!?])\s+|\n{2,}/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && (s.match(/[a-zA-Z0-9]/g)?.length ?? 0) > 0);

    totalSentences += Math.max(1, sentences.length);
    for (const s of sentences) {
      if (s.endsWith('?')) totalQuestions++;
    }

    const contractions = text.match(CONTRACTIONS_RE) ?? [];
    totalContractions += contractions.length;

    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      const openMatch = lines[0].replace(/[,:!]+$/, '').match(OPENING_RE);
      if (openMatch && !openings.includes(openMatch[1])) {
        openings.push(openMatch[1]);
      }
    }
    for (let idx = lines.length - 1; idx >= Math.max(0, lines.length - 3); idx--) {
      const closeMatch = lines[idx].replace(/[,:!]+$/, '').match(CLOSING_RE);
      if (closeMatch) {
        const label =
          closeMatch[1].charAt(0).toUpperCase() + closeMatch[1].slice(1);
        if (!closings.includes(label)) {
          closings.push(label);
        }
        break;
      }
    }
  }

  const avgSentenceLength = Number(
    (totalWords / Math.max(1, totalSentences)).toFixed(1)
  );
  // Percentage of sentences using contractions, capped at 100
  const contractionRate = Math.min(
    100,
    Math.round((totalContractions / Math.max(1, totalSentences)) * 100)
  );
  const questionRate = Math.min(
    100,
    Math.round((totalQuestions / Math.max(1, totalSentences)) * 100)
  );

  const lengthDesc =
    avgSentenceLength <= 13
      ? 'crisp, punchy sentences'
      : avgSentenceLength <= 21
        ? 'balanced, clear sentences'
        : 'detailed, thorough sentences';
  const registerDesc =
    contractionRate >= 15
      ? 'in a conversational and natural register'
      : 'in a polished, structured register';
  const closingClause =
    closings.length > 0 ? `, often closing with "${closings[0]}"` : '';

  const summary = `Writes with ${lengthDesc} (~${avgSentenceLength} words/sentence), ${registerDesc}${closingClause}.`;

  return {
    activeCount: active.length,
    totalWords,
    avgSentenceLength,
    contractionRate,
    questionRate,
    commonOpenings: openings.slice(0, 4),
    commonClosings: closings.slice(0, 4),
    summary,
  };
}

/**
 * Selects the most contextually relevant active writing samples for a drafting job.
 */
export function selectVoiceSamples(
  samples: WritingSample[],
  contextOrIntent: string,
  limit = 3
): WritingSample[] {
  const active = samples.filter((s) => s.active && s.content.trim().length > 0);
  if (active.length <= limit) return active;

  const queryTokens = new Set(tokenizeText(contextOrIntent));
  const scored = active.map((sample, idx) => {
    const tagTokens = tokenizeText(sample.contextTag);
    const titleTokens = tokenizeText(sample.title);
    const contentTokens = new Set(tokenizeText(sample.content));

    let score = 0;
    for (const qt of queryTokens) {
      if (tagTokens.includes(qt)) score += 5;
      if (titleTokens.includes(qt)) score += 3;
      if (contentTokens.has(qt)) score += 1;
    }
    return { sample, score, idx };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.idx - b.idx;
  });

  return scored.slice(0, limit).map((item) => item.sample);
}
