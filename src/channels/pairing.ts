import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const PAIRING_DIR = path.join(os.homedir(), '.azerclaw');
const DEFAULT_PAIRING_FILE = path.join(PAIRING_DIR, 'pairings.json');
const DEFAULT_PENDING_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface PendingPairing {
  platform: string;
  senderId: string;
  senderName: string;
  channelId: string;
  code: string;
  requestedAt: string;
  expiresAt: string;
}

export interface ApprovedPairing {
  platform: string;
  senderId: string;
  senderName: string;
  approvedAt: string;
  approvedBy: string;
}

interface PairingData {
  pending: PendingPairing[];
  approved: ApprovedPairing[];
}

function ensurePairingDir(): void {
  if (!fs.existsSync(PAIRING_DIR)) {
    fs.mkdirSync(PAIRING_DIR, { recursive: true, mode: 0o700 });
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function generatePairingCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export class PairingStore {
  private data: PairingData = { pending: [], approved: [] };

  constructor(
    private filePath: string = DEFAULT_PAIRING_FILE,
    private pendingTtlMs: number = DEFAULT_PENDING_TTL_MS
  ) {
    ensurePairingDir();
    this.load();
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) {
        this.save();
        return;
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as PairingData;
      this.data = {
        pending: Array.isArray(parsed.pending) ? parsed.pending : [],
        approved: Array.isArray(parsed.approved) ? parsed.approved : [],
      };
      this.pruneExpiredPending();
    } catch {
      this.data = { pending: [], approved: [] };
      this.save();
    }
  }

  private save(): void {
    fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), { mode: 0o600 });
  }

  private pruneExpiredPending(): void {
    const now = Date.now();
    const before = this.data.pending.length;
    this.data.pending = this.data.pending.filter(p => new Date(p.expiresAt).getTime() > now);
    if (this.data.pending.length !== before) {
      this.save();
    }
  }

  requestPairing(input: {
    platform: string;
    senderId: string;
    senderName: string;
    channelId: string;
  }): PendingPairing {
    this.pruneExpiredPending();
    const existing = this.data.pending.find(p =>
      p.platform === input.platform && p.senderId === input.senderId
    );
    if (existing) return existing;

    let code = generatePairingCode();
    while (this.data.pending.some(p => p.code === code)) {
      code = generatePairingCode();
    }

    const pending: PendingPairing = {
      platform: input.platform,
      senderId: input.senderId,
      senderName: input.senderName,
      channelId: input.channelId,
      code,
      requestedAt: nowIso(),
      expiresAt: new Date(Date.now() + this.pendingTtlMs).toISOString(),
    };

    this.data.pending.push(pending);
    this.save();
    return pending;
  }

  approve(platform: string, code: string, approvedBy = 'cli'): ApprovedPairing | null {
    this.pruneExpiredPending();
    const normalizedCode = code.trim().toUpperCase();
    const idx = this.data.pending.findIndex(
      p => p.platform === platform && p.code.toUpperCase() === normalizedCode
    );
    if (idx < 0) return null;

    const pending = this.data.pending[idx];
    this.data.pending.splice(idx, 1);

    this.data.approved = this.data.approved.filter(
      p => !(p.platform === pending.platform && p.senderId === pending.senderId)
    );

    const approved: ApprovedPairing = {
      platform: pending.platform,
      senderId: pending.senderId,
      senderName: pending.senderName,
      approvedAt: nowIso(),
      approvedBy,
    };
    this.data.approved.push(approved);
    this.save();
    return approved;
  }

  revoke(platform: string, senderId: string): boolean {
    const before = this.data.approved.length;
    this.data.approved = this.data.approved.filter(
      p => !(p.platform === platform && p.senderId === senderId)
    );
    const changed = this.data.approved.length !== before;
    if (changed) this.save();
    return changed;
  }

  isApproved(platform: string, senderId: string, allowFrom: string[] = []): boolean {
    if (allowFrom.includes('*') || allowFrom.includes(senderId)) return true;
    return this.data.approved.some(p => p.platform === platform && p.senderId === senderId);
  }

  listApproved(platform?: string): ApprovedPairing[] {
    return this.data.approved.filter(p => !platform || p.platform === platform);
  }

  listPending(platform?: string): PendingPairing[] {
    this.pruneExpiredPending();
    return this.data.pending.filter(p => !platform || p.platform === platform);
  }
}

let pairingStoreInstance: PairingStore | null = null;

export function getPairingStore(): PairingStore {
  if (!pairingStoreInstance) {
    pairingStoreInstance = new PairingStore();
  }
  return pairingStoreInstance;
}
