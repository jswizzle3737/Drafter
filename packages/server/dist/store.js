import fs from 'node:fs';
import path from 'node:path';
export class CompanionStore {
    db;
    dataFile;
    constructor(dataFile) {
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
            }
            catch {
                // Ignore corrupt store and start clean
            }
        }
    }
    persist() {
        if (!this.dataFile)
            return;
        const dir = path.dirname(this.dataFile);
        fs.mkdirSync(dir, { recursive: true });
        const tmpFile = `${this.dataFile}.${process.pid}.tmp`;
        fs.writeFileSync(tmpFile, JSON.stringify(this.db, null, 2), 'utf8');
        fs.renameSync(tmpFile, this.dataFile);
    }
    getUserByEmail(email) {
        const key = email.trim().toLowerCase();
        const id = this.db.emailToUserId[key];
        return id ? this.db.users[id] : undefined;
    }
    getUserById(id) {
        return this.db.users[id];
    }
    saveUser(user) {
        const normalizedEmail = user.email.trim().toLowerCase();
        this.db.users[user.id] = { ...user, email: normalizedEmail };
        this.db.emailToUserId[normalizedEmail] = user.id;
        this.persist();
    }
    getCheckoutSession(sessionId) {
        return this.db.sessions[sessionId];
    }
    saveCheckoutSession(session) {
        this.db.sessions[session.sessionId] = session;
        this.persist();
    }
    getVault(userId) {
        return this.db.vaults[userId];
    }
    saveVault(userId, vault) {
        this.db.vaults[userId] = vault;
        this.persist();
    }
}
//# sourceMappingURL=store.js.map