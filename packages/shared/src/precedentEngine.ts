import type {
  PrecedentChunk,
  PrecedentDocument,
  RankedPrecedent,
} from './types.js';

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can', 'could',
  'do', 'does', 'for', 'from', 'had', 'has', 'have', 'he', 'her', 'here', 'his',
  'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me', 'my', 'no',
  'not', 'of', 'on', 'or', 'our', 'out', 'she', 'so', 'some', 'such', 'than',
  'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this', 'to',
  'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who',
  'will', 'with', 'would', 'you', 'your',
]);

export function tokenizeText(text: string): string[] {
  const raw = text.toLowerCase().match(/[a-z0-9]+/g);
  if (!raw) return [];
  const out: string[] = [];
  for (const tok of raw) {
    if (tok.length < 2 && !/^\d+$/.test(tok)) continue;
    if (STOP_WORDS.has(tok)) continue;
    out.push(tok);
  }
  return out;
}

export interface ChunkOptions {
  maxChunkChars?: number;
}

/**
 * Splits a precedent document into structured chunks while preserving markdown section headings
 * and breaking cleanly along section / paragraph boundaries.
 */
export function chunkPrecedentDocument(
  doc: PrecedentDocument,
  options: ChunkOptions = {}
): PrecedentChunk[] {
  const maxChunkChars = Math.max(120, options.maxChunkChars ?? 520);
  const body = doc.body.replace(/\r\n/g, '\n').trim();
  if (!body) {
    return [
      {
        docId: doc.id,
        chunkIndex: 0,
        heading: doc.title,
        text: doc.guidance || doc.whenToUse || doc.title,
      },
    ];
  }

  const lines = body.split('\n');
  interface Section {
    heading: string;
    paragraphs: string[];
  }

  const sections: Section[] = [];
  let currentHeading = doc.title;
  let currentParagraphLines: string[] = [];
  let currentParagraphs: string[] = [];

  const flushParagraph = () => {
    const joined = currentParagraphLines.join('\n').trim();
    if (joined) currentParagraphs.push(joined);
    currentParagraphLines = [];
  };

  const flushSection = () => {
    flushParagraph();
    if (currentParagraphs.length > 0) {
      sections.push({ heading: currentHeading, paragraphs: currentParagraphs });
      currentParagraphs = [];
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushSection();
      currentHeading = headingMatch[2].trim();
      continue;
    }

    if (line.trim() === '') {
      flushParagraph();
    } else {
      currentParagraphLines.push(line);
    }
  }
  flushSection();

  if (sections.length === 0) {
    sections.push({ heading: doc.title, paragraphs: [body] });
  }

  const chunks: PrecedentChunk[] = [];
  let chunkIndex = 0;

  for (const section of sections) {
    const prefix = `${section.heading}\n`;
    let buffer = '';

    for (const para of section.paragraphs) {
      if (para.length > maxChunkChars && buffer.length === 0) {
        // Long single paragraph: split on sentence boundaries if needed
        const sentences = para.match(/[^.!?]+[.!?]*\s*/g) ?? [para];
        let sentBuf = '';
        for (const s of sentences) {
          if (sentBuf && sentBuf.length + s.length > maxChunkChars) {
            chunks.push({
              docId: doc.id,
              chunkIndex: chunkIndex++,
              heading: section.heading,
              text: `${prefix}${sentBuf.trim()}`,
            });
            sentBuf = s;
          } else {
            sentBuf += s;
          }
        }
        if (sentBuf.trim()) {
          buffer = sentBuf.trim();
        }
        continue;
      }

      const candidate = buffer ? `${buffer}\n\n${para}` : para;
      if (buffer && candidate.length + prefix.length > maxChunkChars) {
        chunks.push({
          docId: doc.id,
          chunkIndex: chunkIndex++,
          heading: section.heading,
          text: `${prefix}${buffer}`,
        });
        buffer = para;
      } else {
        buffer = candidate;
      }
    }

    if (buffer) {
      chunks.push({
        docId: doc.id,
        chunkIndex: chunkIndex++,
        heading: section.heading,
        text: `${prefix}${buffer}`,
      });
    }
  }

  return chunks;
}

interface Posting {
  docIdx: number;
  weight: number;
}

export interface PrecedentIndex {
  docs: PrecedentDocument[];
  docChunks: PrecedentChunk[][];
  postings: Map<string, Posting[]>;
  idf: Map<string, number>;
  docNorms: Float64Array;
  tagSets: Set<string>[];
}

function addWeightedTokens(
  weights: Map<string, number>,
  tokens: string[],
  multiplier: number
): void {
  for (const tok of tokens) {
    weights.set(tok, (weights.get(tok) ?? 0) + multiplier);
    // Also add 4-char prefix stem for lightweight morphological matching (pricing/price, renewal/renew)
    if (tok.length >= 5) {
      const stem = tok.slice(0, 4);
      weights.set(stem, (weights.get(stem) ?? 0) + multiplier * 0.45);
    }
  }
}

export function buildPrecedentIndex(
  precedents: PrecedentDocument[]
): PrecedentIndex {
  const postings = new Map<string, Posting[]>();
  const docNorms = new Float64Array(precedents.length);
  const docChunks: PrecedentChunk[][] = new Array(precedents.length);
  const tagSets: Set<string>[] = new Array(precedents.length);
  const docTermFreqs: Map<string, number>[] = new Array(precedents.length);

  for (let i = 0; i < precedents.length; i++) {
    const doc = precedents[i];
    docChunks[i] = chunkPrecedentDocument(doc);
    tagSets[i] = new Set(
      doc.tags.map((t) => t.trim().toLowerCase()).filter(Boolean)
    );

    const weights = new Map<string, number>();
    addWeightedTokens(weights, tokenizeText(doc.title), 3.0);
    addWeightedTokens(weights, tokenizeText(doc.category), 1.5);
    addWeightedTokens(weights, tokenizeText(doc.tags.join(' ')), 3.5);
    addWeightedTokens(weights, tokenizeText(doc.whenToUse), 2.5);
    addWeightedTokens(weights, tokenizeText(doc.guidance), 2.0);
    addWeightedTokens(weights, tokenizeText(doc.body), 1.0);
    docTermFreqs[i] = weights;
  }

  const N = Math.max(1, precedents.length);
  const df = new Map<string, number>();
  for (const tf of docTermFreqs) {
    for (const term of tf.keys()) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, count] of df.entries()) {
    idf.set(term, Math.log(1 + (N - count + 0.5) / (count + 0.5)) + 0.5);
  }

  for (let i = 0; i < precedents.length; i++) {
    let normSq = 0;
    for (const [term, tfWeight] of docTermFreqs[i].entries()) {
      const w = Math.log(1 + tfWeight) * (idf.get(term) ?? 1);
      normSq += w * w;
      let list = postings.get(term);
      if (!list) {
        list = [];
        postings.set(term, list);
      }
      list.push({ docIdx: i, weight: w });
    }
    docNorms[i] = Math.sqrt(normSq) || 1;
  }

  return { docs: precedents, docChunks, postings, idf, docNorms, tagSets };
}

export interface RankPrecedentsOptions {
  pinnedIds?: string[];
  excludedIds?: string[];
  includeDisabled?: boolean;
  limit?: number;
  minScore?: number;
  index?: PrecedentIndex;
}

/**
 * Ranks precedent documents against a query using an inverted index + tag/title boosts.
 * Honors explicit pin/exclude overrides and disabled flags.
 */
export function rankPrecedents(
  precedents: PrecedentDocument[],
  queryText: string,
  options: RankPrecedentsOptions = {}
): RankedPrecedent[] {
  const index = options.index ?? buildPrecedentIndex(precedents);
  const pinnedSet = new Set(options.pinnedIds ?? []);
  const excludedSet = new Set(options.excludedIds ?? []);
  const queryTokens = tokenizeText(queryText);

  const queryWeights = new Map<string, number>();
  const stemToOrig = new Map<string, string>();

  for (const tok of queryTokens) {
    queryWeights.set(tok, (queryWeights.get(tok) ?? 0) + 1);
    stemToOrig.set(tok, tok);
    if (tok.length >= 5) {
      const stem = tok.slice(0, 4);
      queryWeights.set(stem, (queryWeights.get(stem) ?? 0) + 0.45);
      if (!stemToOrig.has(stem)) stemToOrig.set(stem, tok);
    }
  }

  let qNormSq = 0;
  const qTermWeights = new Map<string, number>();
  for (const [term, tf] of queryWeights.entries()) {
    const w = Math.log(1 + tf) * (index.idf.get(term) ?? 1);
    qTermWeights.set(term, w);
    qNormSq += w * w;
  }
  const qNorm = Math.sqrt(qNormSq) || 1;

  const docScores = new Float64Array(index.docs.length);
  const docMatchedTerms: Set<string>[] = Array.from(
    { length: index.docs.length },
    () => new Set<string>()
  );

  for (const [term, qWeight] of qTermWeights.entries()) {
    const postingList = index.postings.get(term);
    if (!postingList) continue;
    const displayTerm = stemToOrig.get(term) ?? term;
    for (const p of postingList) {
      docScores[p.docIdx] += p.weight * qWeight;
      docMatchedTerms[p.docIdx].add(displayTerm);
    }
  }

  const queryTokenSet = new Set(queryTokens);
  const results: RankedPrecedent[] = [];

  for (let i = 0; i < index.docs.length; i++) {
    const doc = index.docs[i];
    if (!options.includeDisabled && !doc.enabled) continue;
    if (excludedSet.has(doc.id)) continue;

    const isPinned = doc.pinned || pinnedSet.has(doc.id);
    const cosine = docScores[i] / (index.docNorms[i] * qNorm);

    const matchedTags: string[] = [];
    for (const tag of index.tagSets[i]) {
      const tagTokens = tokenizeText(tag);
      const hit = tagTokens.some(
        (tt) =>
          queryTokenSet.has(tt) ||
          (tt.length >= 5 &&
            queryTokens.some((qt) => qt.startsWith(tt.slice(0, 4))))
      );
      if (hit) matchedTags.push(tag);
    }

    const matchedTerms = Array.from(docMatchedTerms[i]);
    const overlapRatio =
      queryTokenSet.size > 0
        ? Math.min(1, matchedTerms.length / Math.min(5, queryTokenSet.size))
        : 0;
    const tagBoost = Math.min(0.28, matchedTags.length * 0.11);

    let combined = cosine * 0.72 + overlapRatio * 0.35 + tagBoost;
    if (isPinned && combined < 0.75) {
      combined = Math.max(combined, 0.78);
    }

    const pct =
      queryTokens.length === 0
        ? isPinned
          ? 100
          : 0
        : Math.min(99, Math.max(0, Math.round(combined * 115)));

    if (!isPinned && options.minScore !== undefined && pct < options.minScore) {
      continue;
    }

    if (!isPinned && queryTokens.length > 0 && pct === 0 && matchedTags.length === 0) {
      continue;
    }

    // Pick best matching chunk for prompt context
    const chunks = index.docChunks[i];
    let bestChunk: PrecedentChunk | null = chunks[0] ?? null;
    if (chunks.length > 1 && queryTokens.length > 0) {
      let bestChunkHits = -1;
      for (const ch of chunks) {
        const chTokens = new Set(tokenizeText(ch.text));
        let hits = 0;
        for (const qt of queryTokenSet) {
          if (chTokens.has(qt)) hits++;
        }
        if (hits > bestChunkHits) {
          bestChunkHits = hits;
          bestChunk = ch;
        }
      }
    }

    results.push({
      document: doc,
      score: isPinned ? Math.max(pct, 85) : pct,
      rawScore: combined + (isPinned ? 10 : 0),
      matchedTerms: matchedTerms.slice(0, 8),
      matchedTags,
      bestChunk,
      pinned: isPinned,
    });
  }

  results.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return b.rawScore - a.rawScore;
  });

  if (options.limit !== undefined && options.limit > 0) {
    return results.slice(0, options.limit);
  }
  return results;
}
