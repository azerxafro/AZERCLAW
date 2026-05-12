#!/usr/bin/env node
/**
 * 🐟 AZERCLAW build-time secret injector.
 *
 * AZERCLAW is a BYOK ("Bring Your Own Key") CLI — at runtime keys come from
 * the user's settings file or environment variables. This script exists so
 * private distributions (e.g. an official binary release) can opt into baking
 * a default Opencode key into the build without changing the user-facing
 * source.
 *
 * Behavior:
 *   - If `AZERCLAW_INJECT_OPENCODE_KEY` is set, write a `secrets.json` file
 *     into `dist/` containing the key. The runtime never reads this file
 *     directly; it is intended as a hand-off point for downstream packaging.
 *   - Otherwise this script is a no-op so `npm run build` always succeeds.
 *   - Pass `--quiet` to suppress logging.
 *
 * This file MUST NOT contain real secrets. The `secrets.json` it produces
 * should be `.gitignore`d (it is, via the existing `dist/` ignore).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const quiet = process.argv.includes('--quiet');
function log(msg) {
  if (!quiet) console.log(`[inject-secrets] ${msg}`);
}

const distDir = path.resolve(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  log('dist/ not present yet — nothing to inject. Skipping.');
  process.exit(0);
}

const opencodeKey = process.env.AZERCLAW_INJECT_OPENCODE_KEY || '';
if (!opencodeKey) {
  log('No AZERCLAW_INJECT_OPENCODE_KEY in environment — BYOK build. Skipping.');
  process.exit(0);
}

const secretsPath = path.join(distDir, 'secrets.json');
fs.writeFileSync(
  secretsPath,
  JSON.stringify({ opencode: { apiKey: opencodeKey } }, null, 2) + '\n',
  { mode: 0o600 },
);
log(`Wrote ${path.relative(process.cwd(), secretsPath)}`);
