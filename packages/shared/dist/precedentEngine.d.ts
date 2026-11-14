import type { PrecedentChunk, PrecedentDocument, RankedPrecedent } from './types.js';
export declare function tokenizeText(text: string): string[];
export interface ChunkOptions {
    maxChunkChars?: number;
}
/**
 * Splits a precedent document into structured chunks while preserving markdown section headings
 * and breaking cleanly along section / paragraph boundaries.
 */
export declare function chunkPrecedentDocument(doc: PrecedentDocument, options?: ChunkOptions): PrecedentChunk[];
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
export declare function buildPrecedentIndex(precedents: PrecedentDocument[]): PrecedentIndex;
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
export declare function rankPrecedents(precedents: PrecedentDocument[], queryText: string, options?: RankPrecedentsOptions): RankedPrecedent[];
export {};
//# sourceMappingURL=precedentEngine.d.ts.map