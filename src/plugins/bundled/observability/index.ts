/**
 * 🐟 AZERCLAW Observability Plugin
 * Ported from OpenClaw - Metrics, tracing, and performance monitoring
 */

import { Plugin, PluginContext, PluginHealth, Tool, ToolResult } from '../../types';
import { performance } from 'perf_hooks';

// ─── Observability Plugin Implementation ─────────────────────────────────

interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
  unit?: string;
}

interface Trace {
  id: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metadata?: Record<string, unknown>;
  spans?: TraceSpan[];
}

interface TraceSpan {
  id: string;
  parentId?: string;
  name: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  metadata?: Record<string, unknown>;
}

class ObservabilityManager {
  private metrics: Metric[] = [];
  private traces: Map<string, Trace> = new Map();
  private activeSpans: Map<string, TraceSpan> = new Map();
  private maxMetrics: number = 10000;
  private maxTraces: number = 1000;

  recordMetric(name: string, value: number, tags?: Record<string, string>, unit?: string): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags,
      unit
    };

    this.metrics.push(metric);
    
    // Cleanup old metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  startTrace(name: string, metadata?: Record<string, unknown>): string {
    const traceId = this.generateId();
    const trace: Trace = {
      id: traceId,
      name,
      startTime: new Date(),
      metadata
    };

    this.traces.set(traceId, trace);
    return traceId;
  }

  endTrace(traceId: string): void {
    const trace = this.traces.get(traceId);
    if (trace && !trace.endTime) {
      trace.endTime = new Date();
      trace.duration = trace.endTime.getTime() - trace.startTime.getTime();
    }
  }

  startSpan(traceId: string, name: string, parentId?: string, metadata?: Record<string, unknown>): string {
    const spanId = this.generateId();
    const span: TraceSpan = {
      id: spanId,
      parentId,
      name,
      startTime: new Date(),
      metadata
    };

    this.activeSpans.set(spanId, span);
    
    const trace = this.traces.get(traceId);
    if (trace) {
      if (!trace.spans) {
        trace.spans = [];
      }
      trace.spans.push(span);
    }

    return spanId;
  }

  endSpan(spanId: string): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.endTime = new Date();
      span.duration = span.endTime.getTime() - span.startTime.getTime();
      this.activeSpans.delete(spanId);
    }
  }

  getMetrics(name?: string, timeRange?: { start: Date; end: Date }): Metric[] {
    let filtered = this.metrics;

    if (name) {
      filtered = filtered.filter(m => m.name === name);
    }

    if (timeRange) {
      filtered = filtered.filter(m => 
        m.timestamp >= timeRange.start && m.timestamp <= timeRange.end
      );
    }

    return filtered;
  }

  getTraces(name?: string): Trace[] {
    const traces = Array.from(this.traces.values());
    
    if (name) {
      return traces.filter(t => t.name === name);
    }

    return traces;
  }

  getAggregatedMetrics(name: string, timeRange?: { start: Date; end: Date }): {
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
  } {
    const metrics = this.getMetrics(name, timeRange);
    
    if (metrics.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, sum: 0 };
    }

    const values = metrics.map(m => m.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      sum
    };
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  cleanup(): void {
    // Clean up old data
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Clean old metrics
    this.metrics = this.metrics.filter(m => m.timestamp > oneHourAgo);

    // Clean old traces
    for (const [id, trace] of this.traces.entries()) {
      if (trace.startTime < oneHourAgo) {
        this.traces.delete(id);
      }
    }
  }
}

const ObservabilityPlugin: Plugin = {
  metadata: {
    name: 'observability',
    version: '1.0.0',
    description: 'Metrics, tracing, and performance monitoring for AZERCLAW',
    author: 'AZERCLAW',
    license: 'MIT',
    keywords: ['metrics', 'tracing', 'monitoring', 'performance'],
    capabilities: [
      { type: 'system', name: 'metrics', description: 'Collect and query metrics' },
      { type: 'system', name: 'tracing', description: 'Distributed tracing' },
      { type: 'system', name: 'performance', description: 'Performance monitoring' },
      { type: 'tool', name: 'metrics-query', description: 'Query collected metrics' },
      { type: 'tool', name: 'tracing-query', description: 'Query trace data' }
    ],
    requires: [],
    permissions: [
      { type: 'system', scope: 'read', description: 'Read system performance data' },
      { type: 'memory', scope: 'write', description: 'Store observability data' }
    ],
    azerclawVersion: '2.2.0',
    sandbox: {
      enabled: true
    }
  },

  tools: [
    {
      name: 'metrics_query',
      description: 'Query collected metrics and performance data',
      version: '1.0.0',
      author: 'AZERCLAW',
      tags: ['metrics', 'monitoring', 'performance'],
      parameters: {
        type: 'object',
        properties: {
          metric_name: { type: 'string', description: 'Name of the metric to query' },
          time_range: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'Start time (ISO string)' },
              end: { type: 'string', description: 'End time (ISO string)' }
            }
          },
          aggregation: { 
            type: 'string', 
            enum: ['count', 'min', 'max', 'avg', 'sum'],
            description: 'Type of aggregation to perform'
          },
          tags: { type: 'object', description: 'Filter by tags' }
        },
        required: []
      },
      async execute(args: Record<string, unknown>, context?: PluginContext): Promise<ToolResult> {
        try {
          const manager = getObservabilityManager();
          const metricName = args.metric_name as string;
          const timeRange = args.time_range as any;
          const aggregation = args.aggregation as string;

          let metrics = manager.getMetrics(metricName, timeRange ? {
            start: new Date(timeRange.start),
            end: new Date(timeRange.end)
          } : undefined);

          // Filter by tags if provided
          if (args.tags) {
            const tags = args.tags as Record<string, string>;
            metrics = metrics.filter(m => {
              if (!m.tags) return false;
              return Object.entries(tags).every(([key, value]) => m.tags![key] === value);
            });
          }

          if (aggregation) {
            const agg = manager.getAggregatedMetrics(metricName, timeRange ? {
              start: new Date(timeRange.start),
              end: new Date(timeRange.end)
            } : undefined);

            return {
              success: true,
              output: `Metric "${metricName}" ${aggregation}: ${agg[aggregation as keyof typeof agg]}`,
              metadata: {
                aggregation: agg,
                metric_name: metricName,
                time_range: timeRange
              }
            };
          }

          // Return raw metrics
          const formatted = metrics.slice(0, 10).map(m => 
            `${m.timestamp.toISOString()}: ${m.value}${m.unit ? ' ' + m.unit : ''}`
          ).join('\n');

          return {
            success: true,
            output: `Found ${metrics.length} metrics for "${metricName}":\n\n${formatted}${metrics.length > 10 ? '\n... (showing first 10)' : ''}`,
            metadata: {
              metrics: metrics.slice(0, 10),
              total_count: metrics.length,
              metric_name: metricName
            }
          };
        } catch (error) {
          return {
            success: false,
            output: '',
            error: `Metrics query failed: ${(error as Error).message}`
          };
        }
      }
    },

    {
      name: 'tracing_query',
      description: 'Query trace data and performance traces',
      version: '1.0.0',
      author: 'AZERCLAW',
      tags: ['tracing', 'performance', 'debugging'],
      parameters: {
        type: 'object',
        properties: {
          trace_name: { type: 'string', description: 'Name of the trace to query' },
          trace_id: { type: 'string', description: 'Specific trace ID to query' },
          include_spans: { type: 'boolean', description: 'Include span details', default: true }
        },
        required: []
      },
      async execute(args: Record<string, unknown>): Promise<ToolResult> {
        try {
          const manager = getObservabilityManager();
          const traceName = args.trace_name as string;
          const traceId = args.trace_id as string;
          const includeSpans = (args.include_spans as boolean) !== false;

          let traces: Trace[] = [];

          if (traceId) {
            const trace = manager.getTraces().find(t => t.id === traceId);
            if (trace) traces = [trace];
          } else {
            traces = manager.getTraces(traceName);
          }

          if (traces.length === 0) {
            return {
              success: true,
              output: 'No traces found matching the criteria.',
              metadata: { traces: [] }
            };
          }

          // Format trace information
          const output = traces.map(trace => {
            let info = `**Trace: ${trace.name}** (${trace.id})\n`;
            info += `Duration: ${trace.duration ? `${trace.duration}ms` : 'Running'}\n`;
            info += `Started: ${trace.startTime.toISOString()}\n`;
            
            if (trace.endTime) {
              info += `Ended: ${trace.endTime.toISOString()}\n`;
            }

            if (includeSpans && trace.spans && trace.spans.length > 0) {
              info += `\nSpans:\n`;
              for (const span of trace.spans) {
                info += `  - ${span.name}: ${span.duration || 'Running'}ms\n`;
              }
            }

            return info;
          }).join('\n\n');

          return {
            success: true,
            output: `Found ${traces.length} traces:\n\n${output}`,
            metadata: {
              traces: traces.map(t => ({
                id: t.id,
                name: t.name,
                duration: t.duration,
                span_count: t.spans?.length || 0
              })),
              total_count: traces.length
            }
          };
        } catch (error) {
          return {
            success: false,
            output: '',
            error: `Tracing query failed: ${(error as Error).message}`
          };
        }
      }
    },

    {
      name: 'performance_profile',
      description: 'Generate performance profile and analysis',
      version: '1.0.0',
      author: 'AZERCLAW',
      tags: ['performance', 'analysis', 'profiling'],
      parameters: {
        type: 'object',
        properties: {
          time_range: {
            type: 'object',
            properties: {
              start: { type: 'string', description: 'Start time (ISO string)' },
              end: { type: 'string', description: 'End time (ISO string)' }
            }
          },
          include_recommendations: { type: 'boolean', description: 'Include optimization recommendations', default: true }
        },
        required: []
      },
      async execute(args: Record<string, unknown>): Promise<ToolResult> {
        try {
          const manager = getObservabilityManager();
          const timeRange = args.time_range as any;
          const includeRecommendations = (args.include_recommendations as boolean) !== false;

          const timeFilter = timeRange ? {
            start: new Date(timeRange.start),
            end: new Date(timeRange.end)
          } : undefined;

          // Get performance metrics
          const responseTimeMetrics = manager.getAggregatedMetrics('response_time', timeFilter);
          const throughputMetrics = manager.getAggregatedMetrics('throughput', timeFilter);
          const errorRateMetrics = manager.getAggregatedMetrics('error_rate', timeFilter);

          // Get trace data
          const traces = manager.getTraces();
          const slowTraces = traces.filter(t => t.duration && t.duration > 1000); // > 1s

          let profile = `## Performance Profile\n\n`;
          profile += `**Response Time:**\n`;
          profile += `- Average: ${responseTimeMetrics.avg.toFixed(2)}ms\n`;
          profile += `- Min: ${responseTimeMetrics.min}ms\n`;
          profile += `- Max: ${responseTimeMetrics.max}ms\n`;
          profile += `- Count: ${responseTimeMetrics.count}\n\n`;

          profile += `**Throughput:**\n`;
          profile += `- Total: ${throughputMetrics.sum}\n`;
          profile += `- Average: ${throughputMetrics.avg.toFixed(2)}/min\n\n`;

          profile += `**Error Rate:**\n`;
          profile += `- Average: ${(errorRateMetrics.avg * 100).toFixed(2)}%\n`;
          profile += `- Count: ${errorRateMetrics.count}\n\n`;

          profile += `**Slow Operations:**\n`;
          profile += `- Found ${slowTraces.length} operations > 1s\n`;
          if (slowTraces.length > 0) {
            profile += slowTraces.slice(0, 5).map(t => 
              `- ${t.name}: ${t.duration}ms`
            ).join('\n');
          }

          if (includeRecommendations) {
            profile += `\n\n## Recommendations\n\n`;
            
            if (responseTimeMetrics.avg > 500) {
              profile += `- **High Response Time:** Consider optimizing slow operations or adding caching\n`;
            }
            
            if (errorRateMetrics.avg > 0.05) {
              profile += `- **High Error Rate:** Investigate and fix common error patterns\n`;
            }
            
            if (slowTraces.length > traces.length * 0.1) {
              profile += `- **Many Slow Operations:** Review performance bottlenecks\n`;
            }
          }

          return {
            success: true,
            output: profile,
            metadata: {
              response_time: responseTimeMetrics,
              throughput: throughputMetrics,
              error_rate: errorRateMetrics,
              slow_operations: slowTraces.length,
              total_operations: traces.length
            }
          };
        } catch (error) {
          return {
            success: false,
            output: '',
            error: `Performance profiling failed: ${(error as Error).message}`
          };
        }
      }
    }
  ],

  async initialize(context: PluginContext): Promise<void> {
    context.logger.info('Initializing Observability plugin...');
    
    // Start periodic cleanup
    setInterval(() => {
      getObservabilityManager().cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  },

  async activate(context: PluginContext): Promise<void> {
    context.logger.info('Activating Observability plugin...');
    
    // Record activation metric
    const manager = getObservabilityManager();
    manager.recordMetric('plugin_activation', 1, { plugin: 'observability' });
  },

  async healthCheck(): Promise<PluginHealth> {
    try {
      const manager = getObservabilityManager();
      const metricsCount = manager.getMetrics().length;
      const tracesCount = manager.getTraces().length;

      return {
        status: 'healthy',
        message: 'Observability system operating normally',
        lastCheck: new Date(),
        details: {
          metrics_collected: metricsCount,
          traces_collected: tracesCount,
          memory_usage: process.memoryUsage()
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

// ─── Global Observability Manager ───────────────────────────────────────

let observabilityManager: ObservabilityManager | null = null;

function getObservabilityManager(): ObservabilityManager {
  if (!observabilityManager) {
    observabilityManager = new ObservabilityManager();
  }
  return observabilityManager;
}

// Export for use by other parts of the system
export { getObservabilityManager, ObservabilityManager };
export default ObservabilityPlugin;
