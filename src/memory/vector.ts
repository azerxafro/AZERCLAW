/**
 * 🐟 AZERCLAW Vector Memory
 * Adds optional vector embeddings and semantic search to the existing JSON memory store
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { ContextEntry } from './store';

// ─── Vector Memory Types ───────────────────────────────────────────────

export interface VectorEntry {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    type: string;
    sessionId?: string;
    timestamp: string;
    source: string;
    tags?: string[];
    relevance?: number;
  };
}

export interface SemanticSearchOptions {
  limit?: number;
  sessionId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  threshold?: number;
  type?: string;
}

export interface SemanticSearchResult {
  id: string;
  content: string;
  relevance: number;
  timestamp: string;
  sessionId?: string;
  type: string;
  metadata: any;
}

// ─── Simple Embedding Provider ─────────────────────────────────────────

class SimpleEmbeddingProvider {
  // This is a simplified embedding implementation
  // In production, this would use a proper embedding model
  
  async generateEmbedding(text: string): Promise<number[]> {
    // Simple TF-IDF style embedding for demonstration
    // Real implementation would use OpenAI embeddings, sentence-transformers, etc.
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    // Create a simple 128-dimensional vector
    const embedding = new Array(128).fill(0);
    
    // Word frequency weighting
    const wordFreq: Record<string, number> = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
    
    // Map words to vector dimensions (simple hash)
    for (const [word, freq] of Object.entries(wordFreq)) {
      const hash = this.simpleHash(word);
      const dimension = hash % 128;
      embedding[dimension] += freq / words.length;
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }
    
    return embedding;
  }
  
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  async calculateSimilarity(embedding1: number[], embedding2: number[]): Promise<number> {
    // Cosine similarity
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding dimensions must match');
    }
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitude1 += embedding1[i] * embedding1[i];
      magnitude2 += embedding2[i] * embedding2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
  }
}

// ─── Vector Store Implementation ───────────────────────────────────────

export class VectorStore {
  private entries: Map<string, VectorEntry> = new Map();
  private embeddingProvider: SimpleEmbeddingProvider;
  private vectorFile: string;
  private enabled: boolean;
  private saveTimer: NodeJS.Timeout | null = null;
  private dirty: boolean = false;

  constructor(enabled = true) {
    this.enabled = enabled;
    this.embeddingProvider = new SimpleEmbeddingProvider();
    const memoryDir = path.join(os.homedir(), '.azerclaw', 'memory');
    this.vectorFile = path.join(memoryDir, 'vectors.json');
    
    if (enabled) {
      this.load();
      this.registerShutdownHooks();
    }
  }

  private shutdownHooksRegistered = false;
  private registerShutdownHooks(): void {
    if (this.shutdownHooksRegistered) return;
    this.shutdownHooksRegistered = true;

    const flushOnExit = () => {
      try { this.flush(); } catch { /* swallow on shutdown */ }
    };

    // beforeExit: normal event-loop drain (async-safe enough for sync write)
    process.once('beforeExit', flushOnExit);
    // exit: last-chance synchronous hook
    process.once('exit', flushOnExit);
    // signals: flush then re-raise default behavior
    const signalFlush = (signal: NodeJS.Signals) => {
      flushOnExit();
      // Allow other handlers to run; do not force-exit here
      process.removeListener(signal, signalFlush);
    };
    process.once('SIGINT', signalFlush);
    process.once('SIGTERM', signalFlush);
  }

  private load(): void {
    try {
      if (fs.existsSync(this.vectorFile)) {
        const data = JSON.parse(fs.readFileSync(this.vectorFile, 'utf-8'));
        for (const entry of data.entries || []) {
          this.entries.set(entry.id, entry);
        }
      }
    } catch (error) {
      console.warn('[VectorStore] Failed to load vectors, starting fresh:', error);
    }
  }

  private save(): void {
    if (!this.enabled) return;
    
    try {
      const data = { entries: Array.from(this.entries.values()) };
      fs.writeFileSync(this.vectorFile, JSON.stringify(data, null, 2), { mode: 0o600 });
      this.dirty = false;
    } catch (error) {
      console.error('[VectorStore] Failed to save vectors:', error);
    }
  }

  private scheduleSave(): void {
    if (!this.enabled) return;
    this.dirty = true;
    if (this.saveTimer) return; // Already scheduled
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      if (this.dirty) this.save();
    }, 500);
  }

  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) this.save();
  }

  async addEntry(
    content: string,
    metadata: VectorEntry['metadata']
  ): Promise<string> {
    if (!this.enabled) {
      return '';
    }

    const id = `vec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const embedding = await this.embeddingProvider.generateEmbedding(content);

    const entry: VectorEntry = {
      id,
      content,
      embedding,
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString()
      }
    };

    this.entries.set(id, entry);
    this.scheduleSave();

    return id;
  }

  async semanticSearch(
    query: string,
    options: SemanticSearchOptions = {}
  ): Promise<SemanticSearchResult[]> {
    if (!this.enabled) {
      return [];
    }

    const limit = options.limit || 10;
    const threshold = options.threshold || 0.3;
    
    // Generate embedding for query
    const queryEmbedding = await this.embeddingProvider.generateEmbedding(query);
    
    // Calculate similarities
    const results: Array<{
      entry: VectorEntry;
      similarity: number;
    }> = [];

    for (const entry of this.entries.values()) {
      // Apply filters
      if (options.sessionId && entry.metadata.sessionId !== options.sessionId) {
        continue;
      }
      
      if (options.type && entry.metadata.type !== options.type) {
        continue;
      }
      
      if (options.dateRange) {
        const entryTime = new Date(entry.metadata.timestamp);
        const startTime = new Date(options.dateRange.start);
        const endTime = new Date(options.dateRange.end);
        
        if (entryTime < startTime || entryTime > endTime) {
          continue;
        }
      }
      
      // Calculate similarity
      const similarity = await this.embeddingProvider.calculateSimilarity(
        queryEmbedding,
        entry.embedding
      );
      
      if (similarity >= threshold) {
        results.push({ entry, similarity });
      }
    }
    
    // Sort by similarity and limit results
    results.sort((a, b) => b.similarity - a.similarity);
    
    return results.slice(0, limit).map(result => ({
      id: result.entry.id,
      content: result.entry.content,
      relevance: result.similarity,
      timestamp: result.entry.metadata.timestamp,
      sessionId: result.entry.metadata.sessionId,
      type: result.entry.metadata.type,
      metadata: result.entry.metadata
    }));
  }

  async textSearch(query: string, options: SemanticSearchOptions = {}): Promise<SemanticSearchResult[]> {
    if (!this.enabled) {
      return [];
    }

    const limit = options.limit || 10;
    const lowerQuery = query.toLowerCase();
    
    const results: SemanticSearchResult[] = [];
    
    for (const entry of this.entries.values()) {
      // Apply filters
      if (options.sessionId && entry.metadata.sessionId !== options.sessionId) {
        continue;
      }
      
      if (options.type && entry.metadata.type !== options.type) {
        continue;
      }
      
      if (options.dateRange) {
        const entryTime = new Date(entry.metadata.timestamp);
        const startTime = new Date(options.dateRange.start);
        const endTime = new Date(options.dateRange.end);
        
        if (entryTime < startTime || entryTime > endTime) {
          continue;
        }
      }
      
      // Text matching
      const contentMatch = entry.content.toLowerCase().includes(lowerQuery);
      const tagMatch = entry.metadata.tags?.some(tag => 
        tag.toLowerCase().includes(lowerQuery)
      );
      
      if (contentMatch || tagMatch) {
        results.push({
          id: entry.id,
          content: entry.content,
          relevance: contentMatch ? 0.8 : 0.6, // Simple relevance scoring
          timestamp: entry.metadata.timestamp,
          sessionId: entry.metadata.sessionId,
          type: entry.metadata.type,
          metadata: entry.metadata
        });
      }
    }
    
    // Sort by relevance and timestamp
    results.sort((a, b) => {
      if (a.relevance !== b.relevance) {
        return b.relevance - a.relevance;
      }
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
    
    return results.slice(0, limit);
  }

  getEntry(id: string): VectorEntry | undefined {
    return this.entries.get(id);
  }

  deleteEntry(id: string): boolean {
    const result = this.entries.delete(id);
    if (result) {
      this.save();
    }
    return result;
  }

  getStats(): {
    totalEntries: number;
    entriesByType: Record<string, number>;
    oldestEntry?: string;
    newestEntry?: string;
  } {
    const entries = Array.from(this.entries.values());
    const entriesByType: Record<string, number> = {};
    
    let oldestTime: Date | null = null;
    let newestTime: Date | null = null;
    
    for (const entry of entries) {
      // Count by type
      const type = entry.metadata.type;
      entriesByType[type] = (entriesByType[type] || 0) + 1;
      
      // Track oldest/newest
      const entryTime = new Date(entry.metadata.timestamp);
      if (!oldestTime || entryTime < oldestTime) {
        oldestTime = entryTime;
      }
      if (!newestTime || entryTime > newestTime) {
        newestTime = entryTime;
      }
    }
    
    return {
      totalEntries: entries.length,
      entriesByType,
      oldestEntry: oldestTime?.toISOString(),
      newestEntry: newestTime?.toISOString()
    };
  }

  cleanup(olderThanDays = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    let deletedCount = 0;
    
    for (const [id, entry] of this.entries.entries()) {
      const entryDate = new Date(entry.metadata.timestamp);
      if (entryDate < cutoffDate) {
        this.entries.delete(id);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      this.save();
    }
    
    return deletedCount;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (enabled && this.entries.size === 0) {
      this.load();
    }
  }
}

// ─── Enhanced Context Store with Vector Support ─────────────────────────

export class VectorContextStore {
  private vectorStore: VectorStore;
  private originalStore: any; // ContextStore instance

  constructor(originalStore: any, vectorEnabled = true) {
    this.originalStore = originalStore;
    this.vectorStore = new VectorStore(vectorEnabled);
  }

  async addContext(context: {
    type: string;
    content: string;
    sessionId?: string;
    metadata?: any;
  }): Promise<string> {
    // Add to original store
    const key = `ctx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    this.originalStore.set(key, context.content, 'vector', context.metadata?.tags || []);
    
    // Add to vector store
    const vectorId = await this.vectorStore.addEntry(context.content, {
      type: context.type,
      sessionId: context.sessionId,
      source: 'context',
      tags: context.metadata?.tags,
      ...context.metadata
    });
    
    return vectorId;
  }

  async semanticSearch(query: string, options: SemanticSearchOptions = {}): Promise<SemanticSearchResult[]> {
    return this.vectorStore.semanticSearch(query, options);
  }

  async textSearch(query: string, options: SemanticSearchOptions = {}): Promise<SemanticSearchResult[]> {
    return this.vectorStore.textSearch(query, options);
  }

  async getRecentContext(options: {
    sessionId?: string;
    timeWindow?: string;
    limit?: number;
  }): Promise<Array<{
    id: string;
    content: string;
    timestamp: string;
    type: string;
  }>> {
    const timeWindow = options.timeWindow || '24h';
    const limit = options.limit || 50;
    
    // Parse time window
    const now = new Date();
    const timeWindowMs = this.parseTimeWindow(timeWindow);
    const startTime = new Date(now.getTime() - timeWindowMs);
    
    // Search with date range
    const results = await this.vectorStore.semanticSearch('', {
      sessionId: options.sessionId,
      dateRange: {
        start: startTime.toISOString(),
        end: now.toISOString()
      },
      limit,
      threshold: 0 // Get all recent entries
    });
    
    return results.map(r => ({
      id: r.id,
      content: r.content,
      timestamp: r.timestamp,
      type: r.type
    }));
  }

  private parseTimeWindow(timeWindow: string): number {
    // Simple time window parsing (e.g., "1h", "1d", "1w")
    const match = timeWindow.match(/^(\d+)([hdw])$/);
    if (!match) {
      return 24 * 60 * 60 * 1000; // Default to 24 hours
    }
    
    const [, amount, unit] = match;
    const value = parseInt(amount, 10);
    
    switch (unit) {
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  getCount(): Promise<number> {
    return Promise.resolve(this.vectorStore.getStats().totalEntries);
  }

  getVectorStore(): VectorStore {
    return this.vectorStore;
  }
}

// ─── Integration Functions ─────────────────────────────────────────────

let vectorContextStore: VectorContextStore | null = null;

export function getVectorContextStore(originalStore?: any): VectorContextStore {
  if (!vectorContextStore) {
    if (!originalStore) {
      throw new Error('Original context store required for first initialization');
    }
    vectorContextStore = new VectorContextStore(originalStore);
  }
  return vectorContextStore;
}

export function isVectorEnabled(): boolean {
  return vectorContextStore?.getVectorStore().isEnabled() || false;
}
