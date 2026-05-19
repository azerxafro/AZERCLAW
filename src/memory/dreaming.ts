/**
 * 🐟 AZERCLAW Memory Dreaming
 * Periodic memory consolidation and insight generation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { VectorStore, VectorContextStore } from './vector';
import { getSessionStore } from './store';

// ─── Dreaming Types ─────────────────────────────────────────────────────

export interface DreamConfig {
  enabled: boolean;
  interval: number; // minutes
  minMemories: number;
  maxInsights: number;
  insightTypes: InsightType[];
  retentionDays: number;
}

export interface Insight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  confidence: number;
  evidence: string[];
  generatedAt: string;
  metadata: {
    memoryCount: number;
    timeRange: {
      start: string;
      end: string;
    };
    patterns?: string[];
    entities?: string[];
    topics?: string[];
  };
}

export enum InsightType {
  PATTERN = 'pattern',
  ENTITY = 'entity',
  TOPIC = 'topic',
  BEHAVIOR = 'behavior',
  CONNECTION = 'connection',
  ANOMALY = 'anomaly'
}

export interface DreamReport {
  id: string;
  generatedAt: string;
  duration: number;
  memoriesProcessed: number;
  insightsGenerated: number;
  insights: Insight[];
  stats: {
    totalMemories: number;
    newConnections: number;
    patternsFound: number;
    entitiesIdentified: number;
  };
}

// ─── Dreaming Engine Implementation ─────────────────────────────────────

class DreamingEngine {
  private config: DreamConfig;
  private vectorStore: VectorStore;
  private sessionStore: any;
  private dreamFile: string;
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private initialTimeoutId: NodeJS.Timeout | null = null;

  constructor(vectorStore: VectorStore, config: Partial<DreamConfig> = {}) {
    this.vectorStore = vectorStore;
    this.sessionStore = getSessionStore();
    this.config = {
      enabled: true,
      interval: 60, // 1 hour
      minMemories: 50,
      maxInsights: 10,
      insightTypes: [
        InsightType.PATTERN,
        InsightType.ENTITY,
        InsightType.TOPIC,
        InsightType.CONNECTION
      ],
      retentionDays: 30,
      ...config
    };
    
    const memoryDir = path.join(os.homedir(), '.azerclaw', 'memory');
    this.dreamFile = path.join(memoryDir, 'dreams.json');
    
    this.loadDreams();
    // Note: call start() explicitly; do not auto-start in constructor
  }

  private loadDreams(): void {
    try {
      if (fs.existsSync(this.dreamFile)) {
        const data = JSON.parse(fs.readFileSync(this.dreamFile, 'utf-8'));
        // Load existing dreams if needed
      }
    } catch (error) {
      console.warn('[DreamingEngine] Failed to load dreams, starting fresh:', error);
    }
  }

  private saveDream(report: DreamReport): void {
    try {
      let dreams: DreamReport[] = [];
      
      if (fs.existsSync(this.dreamFile)) {
        const data = JSON.parse(fs.readFileSync(this.dreamFile, 'utf-8'));
        dreams = data.dreams || [];
      }
      
      dreams.push(report);
      
      // Keep only recent dreams (based on retention)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
      
      dreams = dreams.filter(dream => 
        new Date(dream.generatedAt) > cutoffDate
      );
      
      const fileData = { dreams, lastDream: report.generatedAt };
      fs.writeFileSync(this.dreamFile, JSON.stringify(fileData, null, 2), { mode: 0o600 });
    } catch (error) {
      console.error('[DreamingEngine] Failed to save dream:', error);
    }
  }

  start(): void {
    if (!this.config.enabled || this.isRunning) {
      return;
    }

    this.isRunning = true;
    console.log('[DreamingEngine] Starting memory dreaming process');
    
    // Schedule periodic dreaming
    this.intervalId = setInterval(() => {
      if (!this.isRunning) return;
      this.dream().catch(error => {
        console.error('[DreamingEngine] Dream cycle failed:', error);
      });
    }, this.config.interval * 60 * 1000);
    
    // Run initial dream after a short delay
    this.initialTimeoutId = setTimeout(() => {
      if (!this.isRunning) return;
      this.dream().catch(error => {
        console.error('[DreamingEngine] Initial dream cycle failed:', error);
      });
    }, 5000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.initialTimeoutId) {
      clearTimeout(this.initialTimeoutId);
      this.initialTimeoutId = null;
    }
    this.isRunning = false;
    console.log('[DreamingEngine] Stopped memory dreaming process');
  }

  async dream(): Promise<DreamReport> {
    const startTime = Date.now();
    console.log('[DreamingEngine] Starting dream cycle...');
    
    try {
      // Gather memories from different sources
      const memories = await this.gatherMemories();
      
      if (memories.length < this.config.minMemories) {
        console.log(`[DreamingEngine] Insufficient memories (${memories.length}), skipping dream cycle`);
        return this.createEmptyReport(startTime);
      }
      
      // Generate insights
      const insights = await this.generateInsights(memories);
      
      // Store insights
      await this.storeInsights(insights);
      
      // Create dream report
      const report: DreamReport = {
        id: `dream_${Date.now()}`,
        generatedAt: new Date().toISOString(),
        duration: Date.now() - startTime,
        memoriesProcessed: memories.length,
        insightsGenerated: insights.length,
        insights,
        stats: this.calculateStats(memories, insights)
      };
      
      this.saveDream(report);
      
      console.log(`[DreamingEngine] Dream cycle completed: ${insights.length} insights from ${memories.length} memories`);
      
      return report;
    } catch (error) {
      console.error('[DreamingEngine] Dream cycle failed:', error);
      return this.createEmptyReport(startTime, error as Error);
    }
  }

  private async gatherMemories(): Promise<Array<{
    content: string;
    timestamp: string;
    source: string;
    type: string;
    sessionId?: string;
  }>> {
    const memories: Array<{
      content: string;
      timestamp: string;
      source: string;
      type: string;
      sessionId?: string;
    }> = [];
    
    // Get recent session messages
    const sessions = this.sessionStore.list(100);
    for (const session of sessions) {
      const fullSession = this.sessionStore.get(session.id);
      if (fullSession) {
        for (const message of fullSession.messages) {
          memories.push({
            content: message.content,
            timestamp: message.timestamp || fullSession.updatedAt,
            source: 'session',
            type: message.role,
            sessionId: session.id
          });
        }
      }
    }
    
    // Get vector memories
    const vectorStats = this.vectorStore.getStats();
    // Note: In a real implementation, we'd retrieve actual vector entries
    // For now, we'll work with session memories
    
    return memories.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      const safeA = isNaN(timeA) ? Date.now() : timeA;
      const safeB = isNaN(timeB) ? Date.now() : timeB;
      return safeB - safeA;
    });
  }

  private async generateInsights(memories: Array<any>): Promise<Insight[]> {
    const insights: Insight[] = [];
    
    for (const insightType of this.config.insightTypes) {
      try {
        const typeInsights = await this.generateInsightsByType(memories, insightType);
        insights.push(...typeInsights);
      } catch (error) {
        console.warn(`[DreamingEngine] Failed to generate ${insightType} insights:`, error);
      }
    }
    
    // Sort by confidence and limit
    insights.sort((a, b) => b.confidence - a.confidence);
    return insights.slice(0, this.config.maxInsights);
  }

  private async generateInsightsByType(
    memories: Array<any>, 
    type: InsightType
  ): Promise<Insight[]> {
    switch (type) {
      case InsightType.PATTERN:
        return this.detectPatterns(memories);
      case InsightType.ENTITY:
        return this.identifyEntities(memories);
      case InsightType.TOPIC:
        return this.extractTopics(memories);
      case InsightType.CONNECTION:
        return this.findConnections(memories);
      case InsightType.BEHAVIOR:
        return this.analyzeBehavior(memories);
      case InsightType.ANOMALY:
        return this.detectAnomalies(memories);
      default:
        return [];
    }
  }

  private detectPatterns(memories: Array<any>): Insight[] {
    const insights: Insight[] = [];
    const patterns: Record<string, number> = {};
    
    // Simple pattern detection - look for repeated phrases/structures
    for (const memory of memories) {
      const words = memory.content.toLowerCase().split(/\s+/);
      const ngrams = this.generateNgrams(words, 3);
      
      for (const ngram of ngrams) {
        patterns[ngram] = (patterns[ngram] || 0) + 1;
      }
    }
    
    // Find significant patterns
    const significantPatterns = Object.entries(patterns)
      .filter(([, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    for (const [pattern, count] of significantPatterns) {
      insights.push({
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: InsightType.PATTERN,
        title: `Repeated Pattern: "${pattern}"`,
        description: `This phrase pattern appeared ${count} times in recent conversations`,
        confidence: Math.min(count / 10, 1.0),
        evidence: memories
          .filter(m => m.content.toLowerCase().includes(pattern))
          .map(m => m.content.substring(0, 100) + '...')
          .slice(0, 3),
        generatedAt: new Date().toISOString(),
        metadata: {
          memoryCount: memories.length,
          timeRange: {
            start: memories[memories.length - 1]?.timestamp || new Date().toISOString(),
            end: memories[0]?.timestamp || new Date().toISOString()
          },
          patterns: [pattern]
        }
      });
    }
    
    return insights;
  }

  private identifyEntities(memories: Array<any>): Insight[] {
    const insights: Insight[] = [];
    const entities: Record<string, number> = {};
    
    // Simple entity detection - capitalized words
    for (const memory of memories) {
      const entityMatches = memory.content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
      if (entityMatches) {
        for (const entity of entityMatches) {
          if (entity.length > 2) { // Filter out short matches
            entities[entity] = (entities[entity] || 0) + 1;
          }
        }
      }
    }
    
    // Find significant entities
    const significantEntities = Object.entries(entities)
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    for (const [entity, count] of significantEntities) {
      insights.push({
        id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: InsightType.ENTITY,
        title: `Frequently Mentioned: ${entity}`,
        description: `This entity was mentioned ${count} times in recent conversations`,
        confidence: Math.min(count / 8, 1.0),
        evidence: memories
          .filter(m => m.content.includes(entity))
          .map(m => m.content.substring(0, 100) + '...')
          .slice(0, 3),
        generatedAt: new Date().toISOString(),
        metadata: {
          memoryCount: memories.length,
          timeRange: {
            start: memories[memories.length - 1]?.timestamp || new Date().toISOString(),
            end: memories[0]?.timestamp || new Date().toISOString()
          },
          entities: [entity]
        }
      });
    }
    
    return insights;
  }

  private extractTopics(memories: Array<any>): Insight[] {
    const insights: Insight[] = [];
    const allText = memories.map(m => m.content).join(' ').toLowerCase();
    const words = allText.split(/\s+/).filter(word => word.length > 3);
    
    // Simple topic extraction using word frequency
    const wordFreq: Record<string, number> = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
    
    // Filter out common words and get significant topics
    const commonWords = new Set(['this', 'that', 'with', 'from', 'they', 'have', 'been', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'would', 'there', 'could']);
    const topics = Object.entries(wordFreq)
      .filter(([word, count]) => count >= 3 && !commonWords.has(word))
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);
    
    if (topics.length > 0) {
      const topicWords = topics.map(([word]) => word).join(', ');
      insights.push({
        id: `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: InsightType.TOPIC,
        title: `Primary Topics: ${topicWords}`,
        description: `The main topics discussed recently were: ${topicWords}`,
        confidence: 0.8,
        evidence: memories.slice(0, 3).map(m => m.content.substring(0, 100) + '...'),
        generatedAt: new Date().toISOString(),
        metadata: {
          memoryCount: memories.length,
          timeRange: {
            start: memories[memories.length - 1]?.timestamp || new Date().toISOString(),
            end: memories[0]?.timestamp || new Date().toISOString()
          },
          topics: topics.map(([word]) => word)
        }
      });
    }
    
    return insights;
  }

  private findConnections(memories: Array<any>): Insight[] {
    const insights: Insight[] = [];
    
    // Simple connection detection - find memories that share keywords
    const connections: Record<string, number[]> = {};
    const keywords = this.extractKeywords(memories);
    
    for (const keyword of keywords) {
      const relatedMemories = memories
        .map((memory, index) => ({ memory, index }))
        .filter(({ memory }) => memory.content.toLowerCase().includes(keyword))
        .map(({ index }) => index);
      
      if (relatedMemories.length >= 2) {
        connections[keyword] = relatedMemories;
      }
    }
    
    // Create insights for strong connections
    const strongConnections = Object.entries(connections)
      .filter(([, indices]) => indices.length >= 3)
      .slice(0, 2);
    
    for (const [keyword, indices] of strongConnections) {
      insights.push({
        id: `connection_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: InsightType.CONNECTION,
        title: `Connected by: ${keyword}`,
        description: `${indices.length} conversations are connected through the keyword "${keyword}"`,
        confidence: Math.min(indices.length / 5, 1.0),
        evidence: indices
          .slice(0, 3)
          .map(i => memories[i].content.substring(0, 100) + '...'),
        generatedAt: new Date().toISOString(),
        metadata: {
          memoryCount: memories.length,
          timeRange: {
            start: memories[memories.length - 1]?.timestamp || new Date().toISOString(),
            end: memories[0]?.timestamp || new Date().toISOString()
          },
          patterns: [keyword]
        }
      });
    }
    
    return insights;
  }

  private analyzeBehavior(memories: Array<any>): Insight[] {
    // Simple behavior analysis - look for patterns in interaction
    const insights: Insight[] = [];
    
    const userMessages = memories.filter(m => m.type === 'user');
    const assistantMessages = memories.filter(m => m.type === 'assistant');
    
    if (userMessages.length > 0) {
      const avgUserLength = userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length;
      
      insights.push({
        id: `behavior_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: InsightType.BEHAVIOR,
        title: 'Communication Pattern',
        description: `Average user message length: ${Math.round(avgUserLength)} characters. User-to-assistant ratio: ${userMessages.length}:${assistantMessages.length}`,
        confidence: 0.7,
        evidence: [
          `User messages: ${userMessages.length}`,
          `Assistant messages: ${assistantMessages.length}`,
          `Average length: ${Math.round(avgUserLength)} chars`
        ],
        generatedAt: new Date().toISOString(),
        metadata: {
          memoryCount: memories.length,
          timeRange: {
            start: memories[memories.length - 1]?.timestamp || new Date().toISOString(),
            end: memories[0]?.timestamp || new Date().toISOString()
          }
        }
      });
    }
    
    return insights;
  }

  private detectAnomalies(memories: Array<any>): Insight[] {
    // Simple anomaly detection - look for unusual patterns
    const insights: Insight[] = [];
    
    const lengths = memories.map(m => m.content.length);
    const avgLength = lengths.reduce((sum, len) => sum + len, 0) / lengths.length;
    const threshold = avgLength * 3; // 3x average as anomaly threshold
    
    const anomalies = memories.filter(m => m.content.length > threshold);
    
    if (anomalies.length > 0) {
      insights.push({
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: InsightType.ANOMALY,
        title: 'Unusually Long Messages',
        description: `Found ${anomalies.length} messages significantly longer than average (${Math.round(avgLength)} chars)`,
        confidence: 0.8,
        evidence: anomalies.slice(0, 3).map(m => `${m.content.length} chars: ${m.content.substring(0, 100)}...`),
        generatedAt: new Date().toISOString(),
        metadata: {
          memoryCount: memories.length,
          timeRange: {
            start: memories[memories.length - 1]?.timestamp || new Date().toISOString(),
            end: memories[0]?.timestamp || new Date().toISOString()
          }
        }
      });
    }
    
    return insights;
  }

  private async storeInsights(insights: Insight[]): Promise<void> {
    // Store insights in the vector store for future reference
    for (const insight of insights) {
      await this.vectorStore.addEntry(
        `${insight.title}: ${insight.description}`,
        {
          type: 'insight',
          source: 'dreaming',
          relevance: insight.confidence,
          timestamp: new Date().toISOString(),
          ...insight.metadata
        }
      );
    }

    // Also store in ContextStore so insights appear in future prompts
    try {
      const { getContextStore } = require('./store');
      const contextStore = getContextStore();
      for (const insight of insights) {
        contextStore.set(
          `insight_${insight.type}_${insight.id}`,
          `${insight.title}: ${insight.description}`,
          'dreaming',
          [insight.type, 'insight', 'auto']
        );
      }
    } catch {
      /* ContextStore may not be available */
    }
  }

  private calculateStats(memories: Array<any>, insights: Insight[]) {
    const patterns = insights.filter(i => i.type === InsightType.PATTERN).length;
    const entities = insights.filter(i => i.type === InsightType.ENTITY).length;
    const connections = insights.filter(i => i.type === InsightType.CONNECTION).length;
    
    return {
      totalMemories: memories.length,
      newConnections: connections,
      patternsFound: patterns,
      entitiesIdentified: entities
    };
  }

  private createEmptyReport(startTime: number, error?: Error): DreamReport {
    return {
      id: `dream_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
      memoriesProcessed: 0,
      insightsGenerated: 0,
      insights: [],
      stats: {
        totalMemories: 0,
        newConnections: 0,
        patternsFound: 0,
        entitiesIdentified: 0
      }
    };
  }

  private generateNgrams(words: string[], n: number): string[] {
    const ngrams: string[] = [];
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  private extractKeywords(memories: Array<any>): string[] {
    const allText = memories.map(m => m.content).join(' ').toLowerCase();
    const words = allText.split(/\s+/).filter(word => word.length > 4);
    
    const wordFreq: Record<string, number> = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
    
    return Object.entries(wordFreq)
      .filter(([, count]) => count >= 2)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 20)
      .map(([word]) => word);
  }

  getRecentInsights(limit = 10): Insight[] {
    try {
      if (fs.existsSync(this.dreamFile)) {
        const data = JSON.parse(fs.readFileSync(this.dreamFile, 'utf-8'));
        const dreams: DreamReport[] = data.dreams || [];
        
        return dreams
          .flatMap(dream => dream.insights)
          .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime())
          .slice(0, limit);
      }
    } catch (error) {
      console.warn('[DreamingEngine] Failed to load recent insights:', error);
    }
    
    return [];
  }

  getConfig(): DreamConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<DreamConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.interval || newConfig.enabled !== undefined) {
      this.stop();
      this.start();
    }
  }
}

// ─── Global Dreaming Engine ─────────────────────────────────────────────

let dreamingEngine: DreamingEngine | null = null;

export function initializeDreaming(vectorStore: VectorStore, config?: Partial<DreamConfig>): DreamingEngine {
  if (dreamingEngine) {
    dreamingEngine.stop();
  }
  
  dreamingEngine = new DreamingEngine(vectorStore, config);
  return dreamingEngine;
}

export function getDreamingEngine(): DreamingEngine | null {
  return dreamingEngine;
}

export function shutdownDreaming(): void {
  if (dreamingEngine) {
    dreamingEngine.stop();
    dreamingEngine = null;
  }
}
