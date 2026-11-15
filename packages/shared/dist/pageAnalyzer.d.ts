import type { DraftIntent, PageContext } from './types.js';
export type DetectedPageKind = 'job' | 'email' | 'article' | 'work_tool' | 'webpage';
export interface DraftSuggestion {
    id: string;
    label: string;
    description: string;
    intent: DraftIntent;
    instruction: string;
    voiceHint: string;
}
export interface PageAnalysis {
    pageKind: DetectedPageKind;
    pageBadge: string;
    summaryLine: string;
    suggestions: DraftSuggestion[];
}
export declare function analyzePageForDraftSuggestions(context: PageContext): PageAnalysis;
//# sourceMappingURL=pageAnalyzer.d.ts.map