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
    customVoiceInstruction?: string;
    appliedPrecedentTitles: string[];
    appliedPrecedentGuidance?: string[];
    footerNote?: string;
}
export declare function buildSandboxDraft(params: SandboxDraftParams): string;
//# sourceMappingURL=sandboxDraft.d.ts.map