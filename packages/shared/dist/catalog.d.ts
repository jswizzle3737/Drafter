import type { DraftIntent, ExtensionPreferences, ModelOption, PrecedentDocument, ProviderId, ProviderMeta, SubscriptionPlan, VoiceProfile, WritingSample } from './types.js';
export declare const INTENT_PRESETS: DraftIntent[];
export declare const REFINEMENT_CHIPS: string[];
export declare const TONE_PRESETS: string[];
export declare const PROVIDER_CATALOG: ProviderMeta[];
export declare const MODEL_CATALOG: ModelOption[];
export declare function getModelsForProvider(provider: ProviderId): ModelOption[];
export declare function getCompatibleModelForProvider(provider: ProviderId, currentModel: string, excludeModel?: string): string;
export declare const SUBSCRIPTION_PLANS: SubscriptionPlan[];
export declare const DEFAULT_PRECEDENTS: PrecedentDocument[];
export declare const DEFAULT_WRITING_SAMPLES: WritingSample[];
export declare const DEFAULT_VOICE_PROFILE: VoiceProfile;
export declare const DEFAULT_PREFERENCES: ExtensionPreferences;
//# sourceMappingURL=catalog.d.ts.map