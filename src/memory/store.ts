/**
 * 🐟 AZERCLAW Memory Store
 * Persistent conversation history and context using lowdb (JSON-based).
 * Zero external dependencies — everything stays local.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { ChatMessage } from '../providers/base';

const MEMORY_DIR = path.join(os.homedir(), '.azerclaw', 'memory');
const SESSIONS_FILE = path.join(MEMORY_DIR, 'sessions.json');
const CONTEXT_FILE = path.join(MEMORY_DIR, 'context.json');
const STATS_FILE = path.join(MEMORY_DIR, 'stats.json');

// ─── Types ──────────────────────────────────────────────────────

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  metadata: Record<string, unknown>;
  tokenCount: number;
}

export interface GlobalStats {
  totalTokens: number;
  dailyTokens: { [date: string]: number };
  monthlyTokens: { [month: string]: number };
}

export interface ContextEntry {
  key: string;
  value: string;
  source: string;
  createdAt: string;
  expiresAt?: string;
  tags: string[];
}

// ─── Ensure directory ───────────────────────────────────────────

function ensureMemoryDir(): void {
  if (!fs.existsSync(MEMORY_DIR)) {
    fs.mkdirSync(MEMORY_DIR, { recursive: true, mode: 0o700 });
  }
}

// ─── Session Store ──────────────────────────────────────────────

export class SessionStore {
  private sessions: Map<string, Session> = new Map();
  private stats: GlobalStats = { totalTokens: 0, dailyTokens: {}, monthlyTokens: {} };

  constructor() {
    ensureMemoryDir();
    this.load();
    this.loadStats();
  }

  private load(): void {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
        for (const session of data.sessions || []) {
          this.sessions.set(session.id, session);
        }
      }
    } catch { /* start fresh */ }
  }

  private loadStats(): void {
    try {
      if (fs.existsSync(STATS_FILE)) {
        this.stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
      }
    } catch { /* start fresh */ }
  }

  public save(): void {
    const data = { sessions: Array.from(this.sessions.values()) };
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  private saveStats(): void {
    fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2), { mode: 0o600 });
  }

  updateGlobalUsage(tokens: number): void {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const month = date.slice(0, 7);

    this.stats.totalTokens += tokens;
    this.stats.dailyTokens[date] = (this.stats.dailyTokens[date] || 0) + tokens;
    this.stats.monthlyTokens[month] = (this.stats.monthlyTokens[month] || 0) + tokens;
    
    this.saveStats();
  }

  getGlobalUsage(): GlobalStats {
    return this.stats;
  }

  create(title?: string): Session {
    const session: Session = {
      id: `sess_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      title: title || `Session ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [],
      metadata: {},
      tokenCount: 0,
    };
    this.sessions.set(session.id, session);
    this.save();
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  addMessage(sessionId: string, message: ChatMessage, usage?: { promptTokens: number, completionTokens: number }): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.messages.push(message);
    session.updatedAt = new Date().toISOString();
    
    if (usage) {
      session.tokenCount += usage.promptTokens + usage.completionTokens;
      this.updateGlobalUsage(usage.promptTokens + usage.completionTokens);
    } else {
      const estimated = Math.ceil(message.content.length / 4);
      session.tokenCount += estimated;
      this.updateGlobalUsage(estimated);
    }
    this.save();
  }

  popMessage(sessionId: string): ChatMessage | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || session.messages.length === 0) return undefined;
    const msg = session.messages.pop();
    this.save();
    return msg;
  }

  list(limit = 20): Session[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, limit)
      .map(s => ({ ...s, messages: [] })); // Don't return full messages in listing
  }

  getRecent(count = 5): Session[] {
    return this.list(count);
  }

  delete(id: string): boolean {
    const result = this.sessions.delete(id);
    if (result) this.save();
    return result;
  }

  /**
   * Search sessions by content.
   */
  search(query: string): Session[] {
    const q = query.toLowerCase();
    return Array.from(this.sessions.values())
      .filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.messages.some(m => m.content.toLowerCase().includes(q))
      )
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  /**
   * Get context window for a session — returns last N messages within token budget.
   */
  getContextWindow(sessionId: string, maxTokens = 8000): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    const messages: ChatMessage[] = [];
    let tokenCount = 0;
    
    // Walk backward from most recent
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const msg = session.messages[i];
      const tokens = Math.ceil(msg.content.length / 4);
      if (tokenCount + tokens > maxTokens) break;
      messages.unshift(msg);
      tokenCount += tokens;
    }
    
    return messages;
  }

  /**
   * Replace the full message history for a session and update the persisted store.
   */
  updateHistory(sessionId: string, messages: ChatMessage[]): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.messages = [...messages];
    session.updatedAt = new Date().toISOString();
    
    // Re-estimate tokens
    let totalTokens = 0;
    for (const msg of messages) {
      totalTokens += Math.ceil(msg.content.length / 4);
    }
    session.tokenCount = totalTokens;
    this.save();
  }

  /**
   * Auto-title a session based on first message.
   */
  autoTitle(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.messages.length === 0) return;
    
    const firstUserMsg = session.messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      session.title = firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? '...' : '');
      this.save();
    }
  }

  // Stub methods for plugin compatibility
  async getSession(id: string): Promise<Session | undefined> { return this.get(id); }
  async getCount(): Promise<number> { return this.sessions.size; }
}

// ─── Context Store (cross-session knowledge) ────────────────────

export class ContextStore {
  private entries: Map<string, ContextEntry> = new Map();

  constructor() {
    ensureMemoryDir();
    this.load();
  }

  private load(): void {
    try {
      if (fs.existsSync(CONTEXT_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONTEXT_FILE, 'utf-8'));
        for (const entry of data.entries || []) {
          this.entries.set(entry.key, entry);
        }
      }
    } catch { /* start fresh */ }
  }

  private save(): void {
    const data = { entries: Array.from(this.entries.values()) };
    fs.writeFileSync(CONTEXT_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

  set(key: string, value: string, source = 'user', tags: string[] = []): void {
    this.entries.set(key, {
      key, value, source,
      createdAt: new Date().toISOString(),
      tags,
    });
    this.save();
  }

  get(key: string): string | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    // Check expiry
    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      this.entries.delete(key);
      this.save();
      return undefined;
    }
    return entry.value;
  }

  search(query: string): ContextEntry[] {
    const q = query.toLowerCase();
    return Array.from(this.entries.values())
      .filter(e =>
        e.key.toLowerCase().includes(q) ||
        e.value.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      );
  }

  /**
   * Format all context as a system prompt addition.
   */
  toPromptContext(): string {
    if (this.entries.size === 0) return '';
    let ctx = '\n\n## User Context\n';
    for (const [key, entry] of this.entries) {
      ctx += `- **${key}**: ${entry.value}\n`;
    }
    return ctx;
  }

  getAll(): ContextEntry[] {
    return Array.from(this.entries.values());
  }

  delete(key: string): boolean {
    const result = this.entries.delete(key);
    if (result) this.save();
    return result;
  }

  // Stub methods for plugin compatibility
  async semanticSearch(query: string, _options?: any): Promise<any[]> { return this.search(query); }
  async textSearch(query: string, _options?: any): Promise<any[]> { return this.search(query); }
  async getRecentContext(_options?: any): Promise<any[]> { return this.getAll(); }
  async addContext(_entry: any): Promise<void> { /* no-op */ }
  async getContext(key: string): Promise<string | undefined> { return this.get(key); }
  async getCount(): Promise<number> { return this.entries.size; }
  on(_event: string, _listener: (...args: any[]) => void): void { /* no-op */ }
}

// ─── Singletons ─────────────────────────────────────────────────

let sessionStoreInstance: SessionStore | null = null;
let contextStoreInstance: ContextStore | null = null;

export function getSessionStore(): SessionStore {
  if (!sessionStoreInstance) sessionStoreInstance = new SessionStore();
  return sessionStoreInstance;
}

export function getContextStore(): ContextStore {
  if (!contextStoreInstance) contextStoreInstance = new ContextStore();
  return contextStoreInstance;
}
