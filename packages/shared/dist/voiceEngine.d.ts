import type { VoiceAnalysis, WritingSample } from './types.js';
export declare function analyzeWritingSamples(samples: WritingSample[]): VoiceAnalysis;
/**
 * Selects the most contextually relevant active writing samples for a drafting job.
 */
export declare function selectVoiceSamples(samples: WritingSample[], contextOrIntent: string, limit?: number): WritingSample[];
//# sourceMappingURL=voiceEngine.d.ts.map