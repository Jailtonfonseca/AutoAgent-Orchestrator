import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export class CredentialStore {
  private store: Map<string, Map<string, string>> = new Map();
  private waiters: Map<string, (value: string) => void> = new Map();
  private secretKey: Buffer;

  constructor() {
    // In a real app, this would come from process.env.SERVER_SECRET_KEY
    const secret = process.env.SERVER_SECRET_KEY || 'default-secret-key-32-chars-long!!';
    this.secretKey = crypto.scryptSync(secret, 'salt', 32);
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  private decrypt(data: string): string {
    const buffer = Buffer.from(data, 'base64');
    const iv = buffer.subarray(0, IV_LENGTH);
    const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.secretKey, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  set(userId: string, provider: string, value: string) {
    if (!this.store.has(userId)) {
      this.store.set(userId, new Map());
    }
    this.store.get(userId)!.set(provider, this.encrypt(value));
    
    const waiterKey = `${userId}:${provider}`;
    if (this.waiters.has(waiterKey)) {
      const resolve = this.waiters.get(waiterKey)!;
      this.waiters.delete(waiterKey);
      resolve(value);
    }
  }

  get(userId: string, provider: string): string | null {
    const userStore = this.store.get(userId);
    if (!userStore) return null;
    const encrypted = userStore.get(provider);
    return encrypted ? this.decrypt(encrypted) : null;
  }

  delete(userId: string, provider: string): void {
    const userStore = this.store.get(userId);
    if (userStore) {
      userStore.delete(provider);
    }
  }

  has(userId: string, provider: string): boolean {
    return this.store.get(userId)?.has(provider) || false;
  }

  async waitFor(userId: string, provider: string, timeoutMs: number = 3600000): Promise<string | null> {
    const existing = this.get(userId, provider);
    if (existing) return existing;

    return new Promise((resolve) => {
      const waiterKey = `${userId}:${provider}`;
      const timer = setTimeout(() => {
        this.waiters.delete(waiterKey);
        resolve(null);
      }, timeoutMs);

      this.waiters.set(waiterKey, (value) => {
        clearTimeout(timer);
        resolve(value);
      });
    });
  }

  listProviders(userId: string): string[] {
    const userStore = this.store.get(userId);
    return userStore ? Array.from(userStore.keys()) : [];
  }
}

export const credentialStore = new CredentialStore();
