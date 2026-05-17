/**
 * 🐟 AZERCLAW Context Engine Plugin
 * Ported from OpenClaw - Enhanced memory retrieval and context management
 */

import { Plugin, PluginContext, PluginHealth, Tool, ToolResult } from '../../types';
import { getSessionStore, getContextStore } from '../../../memory/store';

// ─── Context Engine Plugin Implementation ───────────────────────────────

const ContextEnginePlugin: Plugin = {
  metadata: {
    name: 'context-engine',
    version: '1.0.0',
    description: 'Enhanced memory retrieval and context management with semantic search',
    author: 'AZERCLAW',
    license: 'MIT',
    keywords: ['memory', 'context', 'search', 'retrieval'],
    capabilities: [
      { type: 'memory', name: 'semantic-search', description: 'Semantic search across memories' },
      { type: 'memory', name: 'context-retrieval', description: 'Intelligent context retrieval' },
      { type: 'tool', name: 'context-search', description: 'Search through conversation history' },
      { type: 'tool', name: 'context-summarize', description: 'Summarize conversation context' }
    ],
    requires: [],
    permissions: [
      { type: 'memory', scope: 'read', description: 'Read access to memory store' },
      { type: 'memory', scope: 'write', description: 'Write access to memory store' }
    ],
    azerclawVersion: '2.2.0',
    sandbox: {
      enabled: true,
      allowedTools: ['memory_read', 'memory_write', 'memory_search']
    }
  },

  tools: [
    {
      name: 'context_search',
      description: 'Search through conversation history and memories with semantic understanding',
      version: '1.0.0',
      author: 'AZERCLAW',
      tags: ['memory', 'search', 'context'],
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          limit: { type: 'number', description: 'Maximum results to return', default: 10 },
          session_id: { type: 'string', description: 'Specific session to search' },
          date_range: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'Start date (ISO)' },
              end: { type: 'string', description: 'End date (ISO)' }
            }
          },
          semantic: { type: 'boolean', description: 'Use semantic search', default: true }
        },
        required: ['query']
      },
      async execute(args: Record<string, unknown>): Promise<ToolResult> {
        try {
          const query = args.query as string;
          const limit = (args.limit as number) || 10;
          const sessionId = args.session_id as string;
          const semantic = (args.semantic as boolean) !== false;
          
          const contextStore = getContextStore();
          const sessionStore = getSessionStore();
          
          let results: any[] = [];
          
          if (semantic) {
            // Semantic search implementation
            results = await contextStore.semanticSearch(query, {
              limit,
              sessionId,
              dateRange: args.date_range as any
            });
          } else {
            // Text-based search
            results = await contextStore.textSearch(query, {
              limit,
              sessionId,
              dateRange: args.date_range as any
            });
          }
          
          // Format results
          const formattedResults = results.map(result => ({
            id: result.id,
            content: result.content,
            relevance: result.relevance || 0,
            timestamp: result.timestamp,
            session_id: result.sessionId,
            type: result.type
          }));
          
          return {
            success: true,
            output: `Found ${formattedResults.length} relevant context items:\n\n${formattedResults.map(r => 
              `[${r.relevance.toFixed(2)}] ${r.content.substring(0, 200)}... (${new Date(r.timestamp).toLocaleDateString()})`
            ).join('\n\n')}`,
            metadata: {
              results: formattedResults,
              total: formattedResults.length,
              query,
              semantic
            }
          };
        } catch (error) {
          return {
            success: false,
            output: '',
            error: `Context search failed: ${(error as Error).message}`
          };
        }
      }
    },

    {
      name: 'context_summarize',
      description: 'Generate intelligent summaries of conversation context',
      version: '1.0.0',
      author: 'AZERCLAW',
      tags: ['memory', 'summary', 'context'],
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string', description: 'Session to summarize' },
          time_window: { type: 'string', description: 'Time window (e.g., "1h", "1d", "1w")' },
          max_tokens: { type: 'number', description: 'Maximum tokens for summary', default: 500 },
          focus_areas: { 
            type: 'array', 
            items: { type: 'string' },
            description: 'Areas to focus on (e.g., ["decisions", "actions", "questions"])'
          }
        },
        required: []
      },
      async execute(args: Record<string, unknown>): Promise<ToolResult> {
        try {
          const sessionId = args.session_id as string;
          const timeWindow = args.time_window as string;
          const maxTokens = (args.max_tokens as number) || 500;
          const focusAreas = (args.focus_areas as string[]) || [];
          
          const sessionStore = getSessionStore();
          const contextStore = getContextStore();
          
          // Get recent context
          const context = await contextStore.getRecentContext({
            sessionId,
            timeWindow,
            limit: 50
          });
          
          if (context.length === 0) {
            return {
              success: true,
              output: 'No context found to summarize.',
              metadata: { summary: '', context_count: 0 }
            };
          }
          
          // Generate summary (simplified implementation)
          const summaryText = await generateContextSummary(context, {
            maxTokens,
            focusAreas
          });
          
          return {
            success: true,
            output: `Context Summary:\n\n${summaryText}`,
            metadata: {
              summary: summaryText,
              context_count: context.length,
              time_window: timeWindow,
              focus_areas: focusAreas
            }
          };
        } catch (error) {
          return {
            success: false,
            output: '',
            error: `Context summarization failed: ${(error as Error).message}`
          };
        }
      }
    },

    {
      name: 'context_extract',
      description: 'Extract key information, entities, and relationships from context',
      version: '1.0.0',
      author: 'AZERCLAW',
      tags: ['memory', 'extraction', 'analysis'],
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to analyze' },
          extract_types: {
            type: 'array',
            items: { type: 'string' },
            description: 'Types to extract (entities, actions, decisions, questions, etc.)'
          },
          session_id: { type: 'string', description: 'Session context' }
        },
        required: ['text']
      },
      async execute(args: Record<string, unknown>): Promise<ToolResult> {
        try {
          const text = args.text as string;
          const extractTypes = (args.extract_types as string[]) || ['entities', 'actions', 'decisions'];
          const sessionId = args.session_id as string;
          
          const extractions = await extractKeyInformation(text, extractTypes);
          
          // Store extractions in context store
          const contextStore = getContextStore();
          for (const extraction of extractions) {
            await contextStore.addContext({
              type: extraction.type,
              content: extraction.content,
              sessionId,
              metadata: extraction.metadata
            });
          }
          
          return {
            success: true,
            output: `Extracted ${extractions.length} key information items:\n\n${extractions.map(e => 
              `**${e.type}**: ${e.content}`
            ).join('\n')}`,
            metadata: {
              extractions,
              text_length: text.length,
              types: extractTypes
            }
          };
        } catch (error) {
          return {
            success: false,
            output: '',
            error: `Context extraction failed: ${(error as Error).message}`
          };
        }
      }
    }
  ],

  async initialize(context: PluginContext): Promise<void> {
    context.logger.info('Initializing Context Engine plugin...');
    
    // Initialize context store extensions
    const contextStore = getContextStore();
    if (!contextStore.semanticSearch) {
      context.logger.warn('Semantic search not available in context store');
    }
  },

  async activate(context: PluginContext): Promise<void> {
    context.logger.info('Activating Context Engine plugin...');
    
    // Set up context monitoring
    const contextStore = getContextStore();
    contextStore.on('context-added', (data: any) => {
      context.events.emit('context-updated', data);
    });
  },

  async healthCheck(): Promise<PluginHealth> {
    try {
      const contextStore = getContextStore();
      const sessionStore = getSessionStore();
      
      // Test basic operations
      await contextStore.getContext('test');
      await sessionStore.getSession('test');
      
      return {
        status: 'healthy',
        message: 'Context engine operating normally',
        lastCheck: new Date(),
        details: {
          semantic_search: typeof contextStore.semanticSearch === 'function',
          context_count: await contextStore.getCount(),
          session_count: await sessionStore.getCount()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Health check failed: ${(error as Error).message}`,
        lastCheck: new Date()
      };
    }
  }
};

// ─── Helper Functions ─────────────────────────────────────────────────

async function generateContextSummary(
  context: any[], 
  options: { maxTokens: number; focusAreas: string[] }
): Promise<string> {
  // Simplified summary generation
  // In a real implementation, this would use an LLM
  const { maxTokens, focusAreas } = options;
  
  let summary = '';
  const sections: Record<string, string[]> = {};
  
  // Group context by type/focus area
  for (const item of context) {
    const area = focusAreas.length > 0 
      ? focusAreas.find(f => item.type?.includes(f)) || 'general'
      : item.type || 'general';
    
    if (!sections[area]) {
      sections[area] = [];
    }
    sections[area].push(item.content);
  }
  
  // Generate summary for each section
  for (const [area, items] of Object.entries(sections)) {
    if (items.length > 0) {
      summary += `**${area.charAt(0).toUpperCase() + area.slice(1)}**:\n`;
      summary += `- ${items.length} items discussed\n`;
      summary += `- Key topics: ${extractTopics(items.join(' ')).join(', ')}\n\n`;
    }
  }
  
  // Truncate if too long
  if (summary.length > maxTokens * 4) { // Rough token estimate
    summary = summary.substring(0, maxTokens * 4) + '...';
  }
  
  return summary;
}

async function extractKeyInformation(
  text: string, 
  types: string[]
): Promise<Array<{ type: string; content: string; metadata: any }>> {
  const extractions: Array<{ type: string; content: string; metadata: any }> = [];
  
  // Simple extraction patterns
  const patterns = {
    entities: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
    actions: /\b(will|should|must|going to|need to)\s+([^.]+)/gi,
    decisions: /\b(decided|chose|selected|agreed)\s+(to|that|on)\s+([^.]+)/gi,
    questions: /\?/g,
    dates: /\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g
  };
  
  for (const type of types) {
    const pattern = patterns[type as keyof typeof patterns];
    if (pattern) {
      const matches = text.match(pattern);
      if (matches) {
        for (const match of matches) {
          extractions.push({
            type,
            content: match.trim(),
            metadata: {
              extracted_at: new Date().toISOString(),
              confidence: 0.8 // Simplified confidence score
            }
          });
        }
      }
    }
  }
  
  return extractions;
}

function extractTopics(text: string): string[] {
  // Simple topic extraction using word frequency
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  const wordCount: Record<string, number> = {};
  for (const word of words) {
    wordCount[word] = (wordCount[word] || 0) + 1;
  }
  
  return Object.entries(wordCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}

export default ContextEnginePlugin;
