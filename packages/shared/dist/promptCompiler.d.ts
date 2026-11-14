import type { CompiledDraftPrompt, DiffLine, DraftIntent, PageContext, PrecedentDocument, VoiceProfile, WritingSample } from './types.js';
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
export declare function compileDraftPrompt(input: CompileDraftPromptInput): CompiledDraftPrompt;
/**
 * Splits a generated draft into `{ subject, body }` cleanly.
 */
export declare function splitSubjectAndBody(rawText: string, fallbackSubject?: string): {
    subject: string;
    body: string;
};
/**
 * Computes a deterministic line-by-line diff using Longest Common Subsequence.
 */
export declare function computeLineDiff(oldText: string, newText: string): DiffLine[];
//# sourceMappingURL=promptCompiler.d.ts.map