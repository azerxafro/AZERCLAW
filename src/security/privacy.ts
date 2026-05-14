/**
 * 🐟 AZERCLAW Privacy Tracking & Data Flow Mapping
 * Comprehensive privacy monitoring and data flow analysis
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import * as crypto from 'crypto';

// ─── Privacy Types ───────────────────────────────────────────────────────

export interface DataFlowEvent {
  id: string;
  timestamp: Date;
  type: DataFlowType;
  source: DataSource;
  destination: DataDestination;
  dataType: DataType;
  dataSize: number;
  sensitivity: SensitivityLevel;
  purpose: string;
  retention?: RetentionPolicy;
  metadata: Record<string, any>;
}

export enum DataFlowType {
  API_CALL = 'api_call',
  MEMORY_STORE = 'memory_store',
  FILE_ACCESS = 'file_access',
  NETWORK_REQUEST = 'network_request',
  PLUGIN_EXECUTION = 'plugin_execution',
  TOOL_EXECUTION = 'tool_execution',
  CONFIG_ACCESS = 'config_access',
  LOGGING = 'logging'
}

export enum DataSource {
  USER_INPUT = 'user_input',
  AI_RESPONSE = 'ai_response',
  MEMORY = 'memory',
  CONFIG = 'config',
  FILE_SYSTEM = 'file_system',
  NETWORK = 'network',
  PLUGIN = 'plugin',
  TOOL = 'tool'
}

export enum DataDestination {
  AI_PROVIDER = 'ai_provider',
  MEMORY = 'memory',
  FILE_SYSTEM = 'file_system',
  NETWORK = 'network',
  LOG = 'log',
  PLUGIN = 'plugin',
  TOOL = 'tool',
  CONSOLE = 'console'
}

export enum DataType {
  TEXT = 'text',
  JSON = 'json',
  BINARY = 'binary',
  IMAGE = 'image',
  AUDIO = 'audio',
  VIDEO = 'video',
  METADATA = 'metadata',
  TOKENS = 'tokens',
  API_KEY = 'api_key',
  PII = 'pii'
}

export enum SensitivityLevel {
  PUBLIC = 'public',
  INTERNAL = 'internal',
  CONFIDENTIAL = 'confidential',
  RESTRICTED = 'restricted',
  PII = 'pii'
}

export interface RetentionPolicy {
  duration: number; // seconds
  autoDelete: boolean;
  encrypted: boolean;
  auditRequired: boolean;
}

export interface PrivacyConfig {
  enabled: boolean;
  logLevel: 'minimal' | 'standard' | 'detailed';
  retentionDays: number;
  encryptSensitive: boolean;
  blockPII: boolean;
  requireConsent: boolean;
  auditMode: boolean;
  dataFilters: DataFilter[];
}

export interface DataFilter {
  type: DataType;
  sensitivity: SensitivityLevel;
  action: 'allow' | 'block' | 'mask' | 'encrypt';
  conditions: string[];
}

export interface PrivacyReport {
  id: string;
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalEvents: number;
    dataTypes: Record<DataType, number>;
    sensitivityLevels: Record<SensitivityLevel, number>;
    dataSources: Record<DataSource, number>;
    dataDestinations: Record<DataDestination, number>;
    totalDataTransferred: number;
  };
  violations: PrivacyViolation[];
  recommendations: string[];
  dataFlowMap: DataFlowMap;
}

export interface PrivacyViolation {
  id: string;
  timestamp: Date;
  type: 'unauthorized_access' | 'data_leak' | 'pii_exposure' | 'retention_violation' | 'consent_missing';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  eventId: string;
  remediation: string;
}

export interface DataFlowMap {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
}

export interface DataFlowNode {
  id: string;
  type: DataSource | DataDestination;
  label: string;
  dataTypes: DataType[];
  sensitivityLevels: SensitivityLevel[];
  eventCount: number;
  totalDataSize: number;
}

export interface DataFlowEdge {
  id: string;
  source: string;
  target: string;
  dataTypes: DataType[];
  sensitivityLevels: SensitivityLevel[];
  eventCount: number;
  totalDataSize: number;
}

// ─── Privacy Manager Implementation ─────────────────────────────────────

export class PrivacyManager extends EventEmitter {
  private config: PrivacyConfig;
  private events: DataFlowEvent[] = [];
  private violations: PrivacyViolation[] = [];
  private consentRecords: Map<string, ConsentRecord> = new Map();
  private dataStorePath: string;
  private isRunning: boolean = false;

  constructor(config: Partial<PrivacyConfig> = {}) {
    super();
    
    this.config = {
      enabled: true,
      logLevel: 'standard',
      retentionDays: 30,
      encryptSensitive: true,
      blockPII: true,
      requireConsent: false,
      auditMode: false,
      dataFilters: [
        {
          type: DataType.API_KEY,
          sensitivity: SensitivityLevel.RESTRICTED,
          action: 'encrypt',
          conditions: ['contains_api_key']
        },
        {
          type: DataType.TEXT,
          sensitivity: SensitivityLevel.PII,
          action: 'mask',
          conditions: ['contains_email', 'contains_phone', 'contains_ssn']
        }
      ],
      ...config
    };
    
    const privacyDir = path.join(os.homedir(), '.azerclaw', 'privacy');
    this.dataStorePath = path.join(privacyDir, 'privacy.json');
    
    this.ensureDirectories();
    this.loadData();
  }

  private ensureDirectories(): void {
    const privacyDir = path.dirname(this.dataStorePath);
    if (!fs.existsSync(privacyDir)) {
      fs.mkdirSync(privacyDir, { recursive: true, mode: 0o700 });
    }
  }

  private loadData(): void {
    try {
      if (fs.existsSync(this.dataStorePath)) {
        const data = JSON.parse(fs.readFileSync(this.dataStorePath, 'utf-8'));
        this.events = (data.events || []).map((e: any) => this.deserializeEvent(e));
        this.violations = (data.violations || []).map((v: any) => this.deserializeViolation(v));
      }
    } catch (error) {
      console.warn('[PrivacyManager] Failed to load privacy data:', error);
    }
  }

  private saveData(): void {
    try {
      const data = {
        events: this.events.map((e) => this.serializeEvent(e)),
        violations: this.violations.map((v) => this.serializeViolation(v)),
        lastUpdated: new Date().toISOString()
      };
      
      fs.writeFileSync(this.dataStorePath, JSON.stringify(data, null, 2), { mode: 0o600 });
    } catch (error) {
      console.error('[PrivacyManager] Failed to save privacy data:', error);
    }
  }

  // ─── Event Tracking ─────────────────────────────────────────────────

  trackDataFlow(event: Partial<DataFlowEvent>): void {
    if (!this.config.enabled) {
      return;
    }

    const fullEvent: DataFlowEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type: event.type || DataFlowType.API_CALL,
      source: event.source || DataSource.USER_INPUT,
      destination: event.destination || DataDestination.AI_PROVIDER,
      dataType: event.dataType || DataType.TEXT,
      dataSize: event.dataSize || 0,
      sensitivity: event.sensitivity || SensitivityLevel.PUBLIC,
      purpose: event.purpose || 'unknown',
      retention: event.retention,
      metadata: event.metadata || {}
    };

    // Apply privacy filters
    const filteredEvent = this.applyDataFilters(fullEvent);
    if (!filteredEvent) {
      return; // Event blocked by filter
    }

    // Check for violations
    this.checkForViolations(filteredEvent);

    // Store event
    this.events.push(filteredEvent);

    // Cleanup old events
    this.cleanupOldEvents();

    // Hard cap to prevent unbounded memory growth
    const MAX_EVENTS = 10000;
    if (this.events.length > MAX_EVENTS) {
      this.events = this.events.slice(-MAX_EVENTS);
    }

    // Save data
    if (this.events.length % 10 === 0) { // Save every 10 events
      this.saveData();
    }

    // Emit event
    this.emit('data-flow-tracked', filteredEvent);

    // Log if detailed logging enabled
    if (this.config.logLevel === 'detailed') {
      console.log(`[Privacy] Data flow: ${filteredEvent.source} -> ${filteredEvent.destination} (${filteredEvent.dataType}, ${filteredEvent.sensitivity})`);
    }
  }

  private applyDataFilters(event: DataFlowEvent): DataFlowEvent | null {
    for (const filter of this.config.dataFilters) {
      if (filter.type === event.dataType && filter.sensitivity === event.sensitivity) {
        switch (filter.action) {
          case 'block':
            this.createViolation({
              id: this.generateViolationId(),
              timestamp: new Date(),
              type: 'unauthorized_access',
              severity: 'medium',
              description: `Data flow blocked by filter: ${filter.type} with sensitivity ${filter.sensitivity}`,
              eventId: event.id,
              remediation: 'Review data filter configuration'
            });
            return null;

          case 'mask':
            event.metadata.masked = true;
            event.metadata.originalSize = event.dataSize;
            event.dataSize = Math.floor(event.dataSize * 0.3); // Estimate masked size
            break;

          case 'encrypt':
            event.metadata.encrypted = true;
            if (this.config.encryptSensitive) {
              event.metadata.encryptedData = this.encryptSensitiveData(event.metadata);
            }
            break;
        }
      }
    }

    return event;
  }

  private checkForViolations(event: DataFlowEvent): void {
    // Check for sensitive data types
    if (event.sensitivity === SensitivityLevel.RESTRICTED) {
      this.createViolation({
        id: this.generateViolationId(),
        timestamp: new Date(),
        type: 'pii_exposure',
        severity: 'high',
        description: 'Restricted data detected',
        eventId: event.id,
        remediation: 'Review data handling and implement proper protection'
      });
    }

    // Check for API key exposure
    if (event.dataType === DataType.API_KEY && event.destination !== DataDestination.MEMORY) {
      this.createViolation({
        id: this.generateViolationId(),
        timestamp: new Date(),
        type: 'data_leak',
        severity: 'critical',
        description: 'API key sent to non-secure destination',
        eventId: event.id,
        remediation: 'Immediately revoke exposed API key'
      });
    }

    // Check for retention violations
    if (event.retention && event.retention.duration > this.config.retentionDays * 24 * 3600) {
      this.createViolation({
        id: this.generateViolationId(),
        timestamp: new Date(),
        type: 'retention_violation',
        severity: 'medium',
        description: 'Data retention period exceeds policy limits',
        eventId: event.id,
        remediation: 'Adjust retention policy or implement auto-deletion'
      });
    }
  }

  private createViolation(violation: PrivacyViolation): void {
    this.violations.push(violation);
    this.emit('privacy-violation', violation);

    if (this.config.auditMode) {
      console.error(`[Privacy] VIOLATION: ${violation.description} (${violation.severity})`);
    }
  }

  // ─── Consent Management ─────────────────────────────────────────────

  requestConsent(purpose: string, dataTypes: DataType[], sensitivityLevels: SensitivityLevel[]): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.config.requireConsent) {
        resolve(true);
        return;
      }

      const consentId = this.generateConsentId();
      const record: ConsentRecord = {
        id: consentId,
        purpose,
        dataTypes,
        sensitivityLevels,
        requestedAt: new Date(),
        status: 'pending'
      };

      this.consentRecords.set(consentId, record);

      // In a real implementation, this would show a user prompt
      // For now, we'll auto-approve in non-interactive mode
      console.log(`[Privacy] Consent requested for: ${purpose}`);
      console.log(`[Privacy] Data types: ${dataTypes.join(', ')}`);
      console.log(`[Privacy] Sensitivity: ${sensitivityLevels.join(', ')}`);

      // Auto-approve for demo purposes
      record.status = 'approved';
      record.decidedAt = new Date();
      resolve(true);
    });
  }

  hasConsent(purpose: string): boolean {
    for (const record of this.consentRecords.values()) {
      if (record.purpose === purpose && record.status === 'approved') {
        return true;
      }
    }
    return false;
  }

  // ─── Reporting and Analysis ─────────────────────────────────────────

  generateReport(timeRange?: { start: Date; end: Date }): PrivacyReport {
    const now = new Date();
    const defaultTimeRange = {
      start: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
      end: now
    };

    const range = timeRange || defaultTimeRange;
    const filteredEvents = this.events.filter(event => 
      event.timestamp >= range.start && event.timestamp <= range.end
    );

    const summary = this.generateSummary(filteredEvents);
    const dataFlowMap = this.generateDataFlowMap(filteredEvents);

    return {
      id: this.generateReportId(),
      generatedAt: now,
      timeRange: range,
      summary,
      violations: this.violations.filter(v => 
        v.timestamp >= range.start && v.timestamp <= range.end
      ),
      recommendations: this.generateRecommendations(summary, this.violations),
      dataFlowMap
    };
  }

  private generateSummary(events: DataFlowEvent[]) {
    const summary = {
      totalEvents: events.length,
      dataTypes: {} as Record<DataType, number>,
      sensitivityLevels: {} as Record<SensitivityLevel, number>,
      dataSources: {} as Record<DataSource, number>,
      dataDestinations: {} as Record<DataDestination, number>,
      totalDataTransferred: 0
    };

    for (const event of events) {
      // Count data types
      summary.dataTypes[event.dataType] = (summary.dataTypes[event.dataType] || 0) + 1;
      
      // Count sensitivity levels
      summary.sensitivityLevels[event.sensitivity] = (summary.sensitivityLevels[event.sensitivity] || 0) + 1;
      
      // Count sources
      summary.dataSources[event.source] = (summary.dataSources[event.source] || 0) + 1;
      
      // Count destinations
      summary.dataDestinations[event.destination] = (summary.dataDestinations[event.destination] || 0) + 1;
      
      // Sum data sizes
      summary.totalDataTransferred += event.dataSize;
    }

    return summary;
  }

  private generateDataFlowMap(events: DataFlowEvent[]): DataFlowMap {
    const nodes: Map<string, DataFlowNode> = new Map();
    const edges: Map<string, DataFlowEdge> = new Map();

    for (const event of events) {
      // Create/update source node
      const sourceId = event.source.toString();
      if (!nodes.has(sourceId)) {
        nodes.set(sourceId, {
          id: sourceId,
          type: event.source,
          label: this.formatNodeLabel(event.source),
          dataTypes: [],
          sensitivityLevels: [],
          eventCount: 0,
          totalDataSize: 0
        });
      }

      const sourceNode = nodes.get(sourceId)!;
      sourceNode.dataTypes.push(event.dataType);
      sourceNode.sensitivityLevels.push(event.sensitivity);
      sourceNode.eventCount++;
      sourceNode.totalDataSize += event.dataSize;

      // Create/update destination node
      const destId = event.destination.toString();
      if (!nodes.has(destId)) {
        nodes.set(destId, {
          id: destId,
          type: event.destination,
          label: this.formatNodeLabel(event.destination),
          dataTypes: [],
          sensitivityLevels: [],
          eventCount: 0,
          totalDataSize: 0
        });
      }

      const destNode = nodes.get(destId)!;
      destNode.dataTypes.push(event.dataType);
      destNode.sensitivityLevels.push(event.sensitivity);
      destNode.eventCount++;
      destNode.totalDataSize += event.dataSize;

      // Create/update edge
      const edgeId = `${sourceId}->${destId}`;
      if (!edges.has(edgeId)) {
        edges.set(edgeId, {
          id: edgeId,
          source: sourceId,
          target: destId,
          dataTypes: [],
          sensitivityLevels: [],
          eventCount: 0,
          totalDataSize: 0
        });
      }

      const edge = edges.get(edgeId)!;
      edge.dataTypes.push(event.dataType);
      edge.sensitivityLevels.push(event.sensitivity);
      edge.eventCount++;
      edge.totalDataSize += event.dataSize;
    }

    // Remove duplicates from arrays
    for (const node of nodes.values()) {
      node.dataTypes = [...new Set(node.dataTypes)];
      node.sensitivityLevels = [...new Set(node.sensitivityLevels)];
    }

    for (const edge of edges.values()) {
      edge.dataTypes = [...new Set(edge.dataTypes)];
      edge.sensitivityLevels = [...new Set(edge.sensitivityLevels)];
    }

    return {
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values())
    };
  }

  private generateRecommendations(summary: any, violations: PrivacyViolation[]): string[] {
    const recommendations: string[] = [];

    // Analyze data types
    if (summary.dataTypes[DataType.API_KEY] > 0) {
      recommendations.push('Review API key handling and ensure encryption');
    }

    if (summary.dataTypes[DataType.PII] > 0) {
      recommendations.push('Implement stronger PII protection measures');
    }

    // Analyze sensitivity levels
    if (summary.sensitivityLevels[SensitivityLevel.PII] > summary.sensitivityLevels[SensitivityLevel.PUBLIC] * 0.1) {
      recommendations.push('High proportion of PII data - consider data minimization');
    }

    // Analyze violations
    const criticalViolations = violations.filter(v => v.severity === 'critical');
    if (criticalViolations.length > 0) {
      recommendations.push('Address critical privacy violations immediately');
    }

    // Analyze data flow patterns
    if (summary.dataDestinations[DataDestination.NETWORK] > summary.dataDestinations[DataDestination.MEMORY]) {
      recommendations.push('Consider reducing network data transfers for privacy');
    }

    return recommendations;
  }

  // ─── Utility Methods ─────────────────────────────────────────────────

  private formatNodeLabel(type: DataSource | DataDestination): string {
    return type.toString().replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  private encryptSensitiveData(data: any): string {
    // Simple encryption for demo purposes
    // In production, use proper encryption
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  private cleanupOldEvents(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    this.events = this.events.filter(event => event.timestamp > cutoffDate);
    this.violations = this.violations.filter(violation => violation.timestamp > cutoffDate);
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateViolationId(): string {
    return `vio_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateConsentId(): string {
    return `con_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private generateReportId(): string {
    return `rpt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  private serializeEvent(event: DataFlowEvent): any {
    return {
      ...event,
      timestamp: event.timestamp.toISOString()
    };
  }

  private deserializeEvent(data: any): DataFlowEvent {
    return {
      ...data,
      timestamp: new Date(data.timestamp)
    };
  }

  private serializeViolation(violation: PrivacyViolation): any {
    return {
      ...violation,
      timestamp: violation.timestamp.toISOString()
    };
  }

  private deserializeViolation(data: any): PrivacyViolation {
    return {
      ...data,
      timestamp: new Date(data.timestamp)
    };
  }

  // ─── Public API ─────────────────────────────────────────────────────

  getEvents(timeRange?: { start: Date; end: Date }): DataFlowEvent[] {
    if (!timeRange) {
      return [...this.events];
    }
    
    return this.events.filter(event => 
      event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
    );
  }

  getViolations(timeRange?: { start: Date; end: Date }): PrivacyViolation[] {
    if (!timeRange) {
      return [...this.violations];
    }
    
    return this.violations.filter(violation => 
      violation.timestamp >= timeRange.start && violation.timestamp <= timeRange.end
    );
  }

  getStats(): {
    totalEvents: number;
    totalViolations: number;
    eventsByType: Record<DataFlowType, number>;
    violationsBySeverity: Record<string, number>;
  } {
    const eventsByType = {} as Record<DataFlowType, number>;
    const violationsBySeverity = {} as Record<string, number>;

    for (const event of this.events) {
      eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;
    }

    for (const violation of this.violations) {
      violationsBySeverity[violation.severity] = (violationsBySeverity[violation.severity] || 0) + 1;
    }

    return {
      totalEvents: this.events.length,
      totalViolations: this.violations.length,
      eventsByType,
      violationsBySeverity
    };
  }

  getConfig(): PrivacyConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveData();
  }

  enable(): void {
    this.config.enabled = true;
    this.emit('privacy-enabled');
  }

  disable(): void {
    this.config.enabled = false;
    this.emit('privacy-disabled');
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  clearData(): void {
    this.events = [];
    this.violations = [];
    this.consentRecords.clear();
    this.saveData();
    this.emit('data-cleared');
  }
}

// ─── Supporting Types ─────────────────────────────────────────────────

interface ConsentRecord {
  id: string;
  purpose: string;
  dataTypes: DataType[];
  sensitivityLevels: SensitivityLevel[];
  requestedAt: Date;
  decidedAt?: Date;
  status: 'pending' | 'approved' | 'denied';
}

// ─── Global Privacy Manager ─────────────────────────────────────────────

let privacyManager: PrivacyManager | null = null;

export function getPrivacyManager(config?: Partial<PrivacyConfig>): PrivacyManager {
  if (!privacyManager) {
    privacyManager = new PrivacyManager(config);
  }
  return privacyManager;
}

export function initializePrivacy(config?: Partial<PrivacyConfig>): PrivacyManager {
  if (privacyManager) {
    privacyManager.removeAllListeners();
  }
  privacyManager = new PrivacyManager(config);
  return privacyManager;
}

export function shutdownPrivacy(): void {
  if (privacyManager) {
    (privacyManager as any).saveData();
    privacyManager.removeAllListeners();
    privacyManager = null;
  }
}
