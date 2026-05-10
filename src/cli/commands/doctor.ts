/**
 * 🐟 AZERCLAW Doctor Command
 * Health check and auto-repair for the AZERCLAW installation.
 */

const chalk = require('chalk');
const gradientString = require('gradient-string');
const { getConfigManager } = require('../../config/manager');
const { getRouter, resetRouter } = require('../../providers/router');
const { auditDmPolicies, applySafeDmDefaults } = require('../../channels/security');
const { fishSuccess, fishError, fishInfo, fishWarn, fishBox, FishThinkingAnimation, renderFishProgress } = require('../animations/fish');

const LUXE = gradientString(['#c084fc', '#818cf8', '#60a5fa', '#34d399']);

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  fix?: () => void;
}

export async function runDoctor(options: { fix?: boolean }): Promise<void> {
  const checks: CheckResult[] = [];
  const config = getConfigManager();
  
  fishBox('🩺 AZERCLAW Doctor', [
    chalk.dim('Running health checks...'),
  ]);
  console.log('');

  const totalChecks = 8;
  let completed = 0;

  // 1. Config file
  renderFishProgress(++completed, totalChecks, 'Config file');
  const fs = require('fs');
  if (fs.existsSync(config.paths.configFile)) {
    checks.push({ name: 'Config File', status: 'pass', message: `Found at ${config.paths.configFile}` });
  } else {
    checks.push({ name: 'Config File', status: 'fail', message: 'Missing', fix: () => config.reset() });
  }

  // 2. Config directories
  renderFishProgress(++completed, totalChecks, 'Directories');
  const dirs = [config.paths.configDir, config.paths.skillsDir, config.paths.memoryDir, config.paths.logsDir];
  const missingDirs = dirs.filter(d => !fs.existsSync(d));
  if (missingDirs.length === 0) {
    checks.push({ name: 'Directories', status: 'pass', message: 'All present' });
  } else {
    checks.push({
      name: 'Directories',
      status: 'warn',
      message: `Missing: ${missingDirs.length}`,
      fix: () => missingDirs.forEach(d => fs.mkdirSync(d, { recursive: true })),
    });
  }

  // 3. File permissions
  renderFishProgress(++completed, totalChecks, 'Permissions');
  try {
    const stats = fs.statSync(config.paths.configFile);
    const mode = (stats.mode & 0o777).toString(8);
    if (mode === '600') {
      checks.push({ name: 'Permissions', status: 'pass', message: 'Config is 0600 (secure)' });
    } else {
      checks.push({
        name: 'Permissions',
        status: 'warn',
        message: `Config is 0${mode} (should be 0600)`,
        fix: () => fs.chmodSync(config.paths.configFile, 0o600),
      });
    }
  } catch {
    checks.push({ name: 'Permissions', status: 'warn', message: 'Cannot check permissions' });
  }

  // 4. Providers configured
  renderFishProgress(++completed, totalChecks, 'Providers');
  const enabled = config.getEnabledProviders();
  if (enabled.length > 0) {
    checks.push({ name: 'Providers', status: 'pass', message: `${enabled.length} configured: ${enabled.map((p: { name: string }) => p.name).join(', ')}` });
  } else {
    checks.push({
      name: 'Providers',
      status: 'fail',
      message: 'No providers configured',
    });
  }

  // 5. Provider connectivity
  renderFishProgress(++completed, totalChecks, 'Connectivity');
  if (enabled.length > 0) {
    resetRouter();
    const router = getRouter();
    const available = router.getAvailableProviders();
    if (available.length > 0) {
      checks.push({ name: 'Connectivity', status: 'pass', message: `${available.length} providers initialized` });
    } else {
      checks.push({ name: 'Connectivity', status: 'warn', message: 'No providers could initialize' });
    }
  } else {
    checks.push({ name: 'Connectivity', status: 'warn', message: 'Skipped (no providers)' });
  }

  // 6. Node.js version
  renderFishProgress(++completed, totalChecks, 'Node.js');
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.slice(1));
  if (major >= 18) {
    checks.push({ name: 'Node.js', status: 'pass', message: nodeVersion });
  } else {
    checks.push({ name: 'Node.js', status: 'warn', message: `${nodeVersion} (recommend 18+)` });
  }

  // 7. DM policy safety
  renderFishProgress(++completed, totalChecks, 'DM policy');
  const dmAudit = auditDmPolicies(config.getAll().channels);
  if (dmAudit.failures.length > 0) {
    checks.push({
      name: 'DM Policy',
      status: 'fail',
      message: `${dmAudit.failures.length} risky DM policy issue(s)`,
      fix: () => { applySafeDmDefaults(config); },
    });
  } else if (dmAudit.warnings.length > 0) {
    checks.push({
      name: 'DM Policy',
      status: 'warn',
      message: `${dmAudit.warnings.length} DM policy warning(s)`,
    });
  } else {
    checks.push({ name: 'DM Policy', status: 'pass', message: 'Safe defaults active' });
  }

  // 8. System info
  renderFishProgress(++completed, totalChecks, 'System');
  const os = require('os');
  checks.push({
    name: 'System',
    status: 'pass',
    message: `${os.platform()} ${os.arch()} | ${os.cpus().length} cores | ${Math.round(os.totalmem() / 1073741824)}GB RAM`,
  });

  // Display results
  console.log('');
  console.log('');
  
  const passed = checks.filter(c => c.status === 'pass').length;
  const warnings = checks.filter(c => c.status === 'warn').length;
  const failures = checks.filter(c => c.status === 'fail').length;

  for (const check of checks) {
    const icon = check.status === 'pass' ? chalk.hex('#34d399')('✓') :
                 check.status === 'warn' ? chalk.hex('#fbbf24')('⚠') :
                 chalk.hex('#f87171')('✗');
    const nameStr = chalk.hex('#e2e8f0')(check.name.padEnd(16));
    const msgStr = check.status === 'pass' ? chalk.dim(check.message) :
                   check.status === 'warn' ? chalk.hex('#fbbf24')(check.message) :
                   chalk.hex('#f87171')(check.message);
    console.log(`  ${icon} ${nameStr} ${msgStr}`);
  }

  console.log('');

  // Auto-fix if requested
  if (options.fix && (warnings > 0 || failures > 0)) {
    const fixable = checks.filter(c => c.fix && c.status !== 'pass');
    if (fixable.length > 0) {
      fishInfo(`Attempting to fix ${fixable.length} issue(s)...`);
      for (const check of fixable) {
        try {
          check.fix!();
          fishSuccess(`Fixed: ${check.name}`);
        } catch (e: any) {
          fishError(`Cannot fix ${check.name}: ${e.message}`);
        }
      }
    }
  }

  // Summary
  if (failures > 0) {
    fishError(`${failures} check(s) failed. Run 'azerclaw onboard' to fix.`);
  } else if (warnings > 0) {
    fishWarn(`${passed} passed, ${warnings} warning(s). Run 'azerclaw doctor --fix' to repair.`);
  } else {
    fishSuccess(`All ${passed} checks passed! 🐟`);
  }
}

module.exports = { runDoctor };
