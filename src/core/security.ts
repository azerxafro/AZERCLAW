/**
 * 🐟 AZERCLAW Security Module
 * Ensures zero data leakage — all data stays local, keys are encrypted,
 * no telemetry, no analytics, no phone-home.
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SECURITY_DIR = path.join(os.homedir(), '.azerclaw');
const AUDIT_LOG = path.join(SECURITY_DIR, 'audit.log');
const ENCRYPTION_KEY_FILE = path.join(SECURITY_DIR, '.keyfile');

// ─── Key Encryption ─────────────────────────────────────────────

/**
 * Get or create a machine-local encryption key.
 * This key never leaves the user's machine.
 */
function getMachineKey(): Buffer {
  if (fs.existsSync(ENCRYPTION_KEY_FILE)) {
    const raw = fs.readFileSync(ENCRYPTION_KEY_FILE);
    return raw;
  }
  
  // Generate a new 256-bit key
  const key = crypto.randomBytes(32);
  fs.mkdirSync(SECURITY_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(ENCRYPTION_KEY_FILE, key, { mode: 0o400 }); // read-only by owner
  return key;
}

/**
 * Encrypt a string value using AES-256-GCM.
 * Returns base64-encoded ciphertext with IV and auth tag.
 */
export function encryptValue(plaintext: string): string {
  const key = getMachineKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:ciphertext (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt a value encrypted with encryptValue.
 */
export function decryptValue(encrypted: string): string {
  const key = getMachineKey();
  const parts = encrypted.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted format');
  
  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─── Audit Logging ──────────────────────────────────────────────

/**
 * Log a security-relevant event to the local audit log.
 * NO data is sent externally — this is purely local.
 */
export function auditLog(event: string, details?: string): void {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${event}${details ? ` | ${details}` : ''}\n`;
  
  try {
    fs.mkdirSync(SECURITY_DIR, { recursive: true, mode: 0o700 });
    fs.appendFileSync(AUDIT_LOG, entry, { mode: 0o600 });
  } catch {
    // Silently fail — never block operations for audit logging
  }
}

// ─── Permission Checks ─────────────────────────────────────────

/**
 * Validate file permissions are secure (owner-only).
 */
export function checkFilePermissions(filePath: string): { secure: boolean; mode: string; issue?: string } {
  try {
    const stats = fs.statSync(filePath);
    const mode = (stats.mode & 0o777).toString(8);
    
    // Check if group or others have any access
    const groupOther = stats.mode & 0o077;
    if (groupOther !== 0) {
      return {
        secure: false,
        mode,
        issue: `File ${filePath} has permissions 0${mode} — group/others can access`,
      };
    }
    
    return { secure: true, mode };
  } catch {
    return { secure: false, mode: '???', issue: `Cannot stat ${filePath}` };
  }
}

/**
 * Fix permissions on a file to be owner-only.
 */
export function fixPermissions(filePath: string, mode: number = 0o600): boolean {
  try {
    fs.chmodSync(filePath, mode);
    auditLog('PERMISSIONS_FIXED', `${filePath} → 0${mode.toString(8)}`);
    return true;
  } catch {
    return false;
  }
}

// ─── Sanitization ───────────────────────────────────────────────

/**
 * Strip API keys from a string for safe logging.
 */
export function sanitizeForLogging(text: string): string {
  // Common API key patterns
  const patterns = [
    /sk-[a-zA-Z0-9]{20,}/g,           // OpenAI
    /sk-ant-[a-zA-Z0-9-]{20,}/g,      // Anthropic
    /sk-or-[a-zA-Z0-9-]{20,}/g,       // OpenRouter
    /gsk_[a-zA-Z0-9]{20,}/g,          // Groq
    /AI[a-zA-Z0-9_-]{30,}/g,          // Google
    /ghp_[a-zA-Z0-9]{20,}/g,          // GitHub
    /glpat-[a-zA-Z0-9_-]{20,}/g,      // GitLab
  ];
  
  let sanitized = text;
  for (const pattern of patterns) {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  }
  return sanitized;
}

/**
 * Sanitize environment variables before passing to child processes.
 */
export function getSafeEnv(): Record<string, string> {
  const env = { ...process.env };
  const sensitiveKeys = [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY',
    'AZERCLAW_OPENAI_KEY', 'AZERCLAW_ANTHROPIC_KEY', 'AZERCLAW_GOOGLE_KEY',
    'AZERCLAW_GROQ_KEY', 'AZERCLAW_DEEPSEEK_KEY', 'AZERCLAW_OPENROUTER_KEY',
    'AWS_SECRET_ACCESS_KEY', 'GITHUB_TOKEN', 'NPM_TOKEN',
  ];
  
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (sensitiveKeys.includes(key)) continue;
    safe[key] = value;
  }
  return safe;
}

// ─── Network Security ───────────────────────────────────────────

/**
 * Validate that a URL is safe to access (no internal/private IPs).
 */
export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;
    
    // Block private/internal IPs
    const privatePatterns = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^0\./,
      /^169\.254\./,
      /^localhost$/i,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i,
    ];
    
    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

// ─── Security Summary ──────────────────────────────────────────

export const SECURITY_POLICY = {
  telemetry: false,
  analytics: false,
  phoneHome: false,
  dataCollection: false,
  keyStorage: 'local-only, AES-256-GCM encrypted',
  filePermissions: '0600 (owner read/write only)',
  auditLog: 'local-only, never transmitted',
  networkPolicy: 'only connects to user-configured LLM providers',
  childProcesses: 'sensitive env vars stripped',
};
