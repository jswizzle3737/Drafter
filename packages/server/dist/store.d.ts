import type { ManagedUser, SubscriptionTierId, VaultPayload } from '@drafter/shared';
export interface StoredUserRecord extends ManagedUser {
    passwordHash: string;
    createdAt: string;
}
export interface StoredCheckoutSession {
    sessionId: string;
    userId: string;
    tier: SubscriptionTierId;
    status: 'open' | 'completed';
    createdAt: string;
}
export interface PersistedDatabase {
    users: Record<string, StoredUserRecord>;
    emailToUserId: Record<string, string>;
    sessions: Record<string, StoredCheckoutSession>;
    vaults: Record<string, VaultPayload>;
}
export declare class CompanionStore {
    private db;
    private readonly dataFile?;
    constructor(dataFile?: string);
    private persist;
    getUserByEmail(email: string): StoredUserRecord | undefined;
    getUserById(id: string): StoredUserRecord | undefined;
    saveUser(user: StoredUserRecord): void;
    getCheckoutSession(sessionId: string): StoredCheckoutSession | undefined;
    saveCheckoutSession(session: StoredCheckoutSession): void;
    getVault(userId: string): VaultPayload | undefined;
    saveVault(userId: string, vault: VaultPayload): void;
}
//# sourceMappingURL=store.d.ts.map