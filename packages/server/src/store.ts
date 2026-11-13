import fs from 'node:fs';
import path from 'node:path';
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

export class CompanionStore {
  private db: PersistedDatabase;
  private readonly dataFile?: string;

  constructor(dataFile?: string) {
    this.dataFile = dataFile;
    this.db = {
      users: {},
      emailToUserId: {},
      sessions: {},
      vaults: {},
    };
    if (dataFile && fs.existsSync(dataFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        this.db = {
          users: parsed.users ?? {},
          emailToUserId: parsed.emailToUserId ?? {},
          sessions: parsed.sessions ?? {},
          vaults: parsed.vaults ?? {},
        };
      } catch {
        // Ignore corrupt store and start clean
      }
    }
  }

  private persist(): void {
    if (!this.dataFile) return;
    const dir = path.dirname(this.dataFile);
    fs.mkdirSync(dir, { recursive: true });
    const tmpFile = `${this.dataFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(this.db, null, 2), 'utf8');
    fs.renameSync(tmpFile, this.dataFile);
  }

  getUserByEmail(email: string): StoredUserRecord | undefined {
    const key = email.trim().toLowerCase();
    const id = this.db.emailToUserId[key];
    return id ? this.db.users[id] : undefined;
  }

  getUserById(id: string): StoredUserRecord | undefined {
    return this.db.users[id];
  }

  saveUser(user: StoredUserRecord): void {
    const normalizedEmail = user.email.trim().toLowerCase();
    this.db.users[user.id] = { ...user, email: normalizedEmail };
    this.db.emailToUserId[normalizedEmail] = user.id;
    this.persist();
  }

  getCheckoutSession(sessionId: string): StoredCheckoutSession | undefined {
    return this.db.sessions[sessionId];
  }

  saveCheckoutSession(session: StoredCheckoutSession): void {
    this.db.sessions[session.sessionId] = session;
    this.persist();
  }

  getVault(userId: string): VaultPayload | undefined {
    return this.db.vaults[userId];
  }

  saveVault(userId: string, vault: VaultPayload): void {
    this.db.vaults[userId] = vault;
    this.persist();
  }
}
