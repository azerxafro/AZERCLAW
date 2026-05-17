import chalk from 'chalk';
import { getPairingStore } from '../../channels/pairing';
import { fishSuccess, fishError, fishInfo, fishBox } from '../animations/fish';

export function pairingList(options: { pending?: boolean; platform?: string } = {}): void {
  const store = getPairingStore();
  const approved = store.listApproved(options.platform);
  const pending = options.pending ? store.listPending(options.platform) : [];

  const lines: string[] = [
    '',
    chalk.hex('#818cf8').bold(`Approved (${approved.length})`),
  ];

  if (approved.length === 0) {
    lines.push(`  ${chalk.dim('none')}`);
  } else {
    for (const entry of approved) {
      lines.push(
        `  ${chalk.hex('#34d399')('●')} ${entry.platform.padEnd(10)} ${entry.senderId.padEnd(20)} ` +
        chalk.dim(`approved ${new Date(entry.approvedAt).toLocaleString()}`)
      );
    }
  }

  if (options.pending) {
    lines.push('');
    lines.push(chalk.hex('#818cf8').bold(`Pending (${pending.length})`));
    if (pending.length === 0) {
      lines.push(`  ${chalk.dim('none')}`);
    } else {
      for (const entry of pending) {
        lines.push(
          `  ${chalk.hex('#fbbf24')('●')} ${entry.platform.padEnd(10)} ${entry.senderId.padEnd(20)} ` +
          chalk.dim(`code ${entry.code} expires ${new Date(entry.expiresAt).toLocaleString()}`)
        );
      }
    }
  }

  fishBox('🔐 DM Pairing', lines);
}

export function pairingApprove(platform: string, code: string): void {
  const store = getPairingStore();
  const approved = store.approve(platform, code, 'cli');
  if (!approved) {
    fishError(`No pending pairing found for ${platform} with code ${code}.`);
    return;
  }

  fishSuccess(`Approved ${approved.senderName} (${approved.senderId}) on ${approved.platform}.`);
}

export function pairingRevoke(platform: string, senderId: string): void {
  const store = getPairingStore();
  const revoked = store.revoke(platform, senderId);
  if (!revoked) {
    fishError(`No approved pairing found for ${platform}:${senderId}.`);
    return;
  }

  fishInfo(`Revoked pairing for ${platform}:${senderId}.`);
}

