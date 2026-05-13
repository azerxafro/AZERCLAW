# AZERCLAW Bugfix-Plan PR — Test Plan

PR: https://github.com/azerxafro/AZERCLAW/pull/1

## What the change does (user-visible)

1. **Banner**: `azerclaw --help` now reads `AZERTRON X2` (previously `AZERTRON X1.0`).
2. **Out-of-the-box providers**: with no settings file, `azerclaw status` reports five ready providers — Opencode, Ollama (Local), LM Studio (Local), LocalAI (Local), Pollinations (Free). Previously only Opencode was wired.
3. **Provider switching works**: `azerclaw config provider <name>` actually flips the active provider for non-opencode names (used to be a silent no-op because every other provider was missing from the schema).
4. **Free, no-API-key AI**: with Pollinations selected, `azerclaw run "..."` actually returns model text from `https://text.pollinations.ai/openai` with zero credentials.
5. **Env-var overrides**: setting any of `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY` / `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY` enables that provider automatically (previously only `AZERTRON_OPENCODE_KEY` was honored).
6. **Build works**: `npm run build` succeeds (previously failed because `scripts/inject-secrets.js` was missing).

This is a CLI tool, so testing is in the terminal. A recording of the terminal session is appropriate (terminal UI is the user-facing surface).

## Test environment

- Node `v22.12.0`, npm `10.8.3`
- Built CLI at `/home/ubuntu/repos/AZERCLAW/dist/bin/azerclaw.js`
- Fresh state before each test: `rm -rf ~/.azerclaw` (config lives at `~/.azerclaw/settings.json`)
- Internet access for the Pollinations test only

Pre-checks (not part of the recorded report — already done while building the plan):
- `curl -sS POST https://text.pollinations.ai/openai` returned a valid OpenAI-shape JSON with `"PASS"` → endpoint is live.
- `node dist/bin/azerclaw.js --version` returned `2.1.4`.

---

## Test 1 — Help banner says `AZERTRON X2` (not X1.0)

**Why this matters**: this is the simplest visual fix. If broken, the banner still says `AZERTRON X1.0`.

**Code reference**: `bin/azerclaw.ts:51` — `.description('🐟 AZERTRON X2 — Diabolical AI · Scorched Earth · Your Way')`

### Steps
1. `rm -rf ~/.azerclaw`
2. `node dist/bin/azerclaw.js --help | head -5`

### Pass criteria (concrete)
- Help output **contains** the substring `AZERTRON X2`.
- Help output **does NOT contain** `AZERTRON X1.0`.

### Adversarial check
A broken implementation would still show `AZERTRON X1.0` (or a regression to it). The assertion explicitly checks for the absence of `X1.0`, so this can't be silently passed.

---

## Test 2 — Fresh-install `status` lists all five keyless providers

**Why this matters**: proves the schema/router wiring (Phase 2). Pre-fix, only `opencode` was in the schema, so the "Providers:" line would only have one entry.

**Code reference**:
- `src/config/schema.ts:60-84` — keyless providers (ollama, lmstudio, localai, pollinations) default to `enabled: true`.
- `src/cli/commands/settings.ts:127-138` — `showStatus()` prints `Providers:   <list>` using `PROVIDER_LABELS`.

### Steps
1. `rm -rf ~/.azerclaw`
2. `node dist/bin/azerclaw.js status`

### Pass criteria (concrete)
The output box `🐟 AZERCLAW Status` shows:
- `Version:` followed by `v2.1.4`
- `Provider:` followed by `Opencode` (the default in `schema.ts:116`)
- `Providers:` line contains **all five** labels, comma-separated, in any order:
  - `Opencode`
  - `Ollama (Local)`
  - `LM Studio (Local)`
  - `LocalAI (Local)`
  - `Pollinations (Free)`
- `Auth Route:` is either `Environment Variable` or `Not Configured` (we have no env vars set in this test).

### Adversarial check
Pre-fix the providers list would only contain `Opencode` (the others didn't exist in the schema). Asserting on all five labels by exact substring detects regression. If schema parsing fails entirely, the CLI would error or print `none` — we'd see that too.

---

## Test 3 — `config provider ollama` actually flips the active provider (was a silent no-op)

**Why this matters**: this is the core "selecting any other provider was a no-op" bug from the plan.

**Code reference**:
- `bin/azerclaw.ts:314-325` — registers `config provider [name]`.
- `src/cli/commands/settings.ts:536-546` — `cliSwitchProvider(providerName)` writes the config and prints `Switched to ${PROVIDER_LABELS[providerName]} (model: ${model})`.

### Steps
1. `rm -rf ~/.azerclaw`
2. `node dist/bin/azerclaw.js config provider ollama`
3. `node dist/bin/azerclaw.js status`

### Pass criteria (concrete)
- Step 2 prints (via fishSuccess, green ✓) the **exact** text `Switched to Ollama (Local) (model: llama3.1)`.
- Step 3's `🐟 AZERCLAW Status` box shows:
  - `Provider:    Ollama (Local)`
  - `Model:       llama3.1`
- `cat ~/.azerclaw/settings.json | jq '.ai.defaultProvider'` returns the string `"ollama"`.

### Adversarial check
Before this PR, `ollama` was not a valid `ProviderName`, so either the call would throw (visible error) or be silently dropped (status still shows `Opencode`). Both states are distinguishable from the pass criteria. The settings.json check is the strongest assertion — it proves persistence, not just a printed message.

---

## Test 4 — End-to-end: Pollinations free provider returns actual text with no API key

**Why this matters**: this is the headline user goal — "free without API Token cost". If the wiring is right but Pollinations is misconfigured (wrong baseUrl, wrong defaultModel, OpenAI SDK rejecting empty apiKey), the prompt would error.

**Code reference**:
- `src/config/schema.ts:79-84` — Pollinations baseUrl `https://text.pollinations.ai/openai`, defaultModel `openai`, no apiKey.
- `src/providers/router.ts` — keyless providers get apiKey `'no-key-required'` so the OpenAI SDK doesn't throw.
- `bin/azerclaw.ts:153-220` — `run <task>` is the one-shot non-interactive command.

### Steps
1. `rm -rf ~/.azerclaw`
2. `node dist/bin/azerclaw.js config provider pollinations`
3. `echo n | node dist/bin/azerclaw.js run "Reply with exactly the single word PINGPONG and nothing else"` (the `echo n` answers any approval prompts negatively to avoid hanging on shell tools — the prompt requires no tools)

### Pass criteria (concrete)
- Step 2 prints `Switched to Pollinations (Free) (model: openai)`.
- Step 3 exits with code 0 (no traceback / no `Error:` line).
- Step 3 stdout contains the substring `PINGPONG` (case-insensitive) somewhere in the response section. This is the strongest possible assertion that an actual LLM responded — random output couldn't produce this nonsense token.

### Adversarial check
If Pollinations isn't wired correctly:
- Wrong baseUrl → OpenAI SDK returns a fetch error.
- Missing apiKey handling → SDK throws `OpenAIError: The OPENAI_API_KEY environment variable is missing or empty`.
- Wrong defaultModel → endpoint returns 404 or 422.
- Provider not registered → `cliSwitchProvider` would have failed in step 2 already.

The `PINGPONG` token is a made-up string that only a real LLM following the instruction can return. If the test fails (no `PINGPONG`), the response is either an error or hallucinated unrelated text.

**Fallback if pollinations is rate-limited**: re-run once. If still flaky, mark the assertion `inconclusive` and report the raw error output to the user — don't silently pass.

---

## Test 5 — Env-var override enables OpenAI without editing config

**Why this matters**: Phase 2 expanded `resolveEnvOverrides()` to recognize standard API key env vars. Pre-fix only `AZERTRON_OPENCODE_KEY` was honored.

**Code reference**:
- `src/config/manager.ts:resolveEnvOverrides()` — now also reads `OPENAI_API_KEY` and friends.
- `src/cli/commands/settings.ts:123-125` — `authRoute === 'env_var'` displays `Environment Variable` in status.

### Steps
1. `rm -rf ~/.azerclaw`
2. `OPENAI_API_KEY=sk-test-fake-12345 node dist/bin/azerclaw.js status`

### Pass criteria (concrete)
- The `Providers:` line in the status box contains both:
  - all 5 keyless providers from Test 2, **and**
  - the label `OpenAI` (added because the env var is set).
- The `Auth Route:` line reads `Environment Variable` (not `Not Configured`).

### Adversarial check
Pre-fix, `OPENAI_API_KEY` was ignored, so OpenAI would not appear in the providers list. The assertion on the label `OpenAI` explicitly checks that the env var was honored. If `resolveEnvOverrides()` fails entirely, the CLI would error or show no providers — both are distinguishable from the pass state.

---

## Test 6 — Build succeeds with no missing scripts

**Why this matters**: the build was broken due to a missing `scripts/inject-secrets.js` file referenced in `package.json`. This test confirms the build pipeline is fixed.

**Code reference**:
- `package.json:22` — `"build": "node scripts/inject-secrets.js && tsc && node scripts/bundle.js"`
- `scripts/inject-secrets.js` — now exists (added in the PR).

### Steps
1. `npm run build`

### Pass criteria (concrete)
- The command exits with code 0.
- The output contains no error lines (no `Error:` or `ENOENT`).
- The final line prints the bundle path (e.g., `Bundled: dist/bin/azerclaw.js`).

### Adversarial check
Pre-fix, the build would fail at the first step with `ENOENT: no such file or directory, open 'scripts/inject-secrets.js'`. If the file is missing again, we'd see that exact error. If TypeScript fails later, we'd see `TS` errors. Both are distinguishable from a clean build.

---

## Summary

This PR fixes 6 user-facing issues:
1. Banner text correction
2. Schema wiring for 4 additional keyless providers
3. Provider switching functionality
4. Free AI via Pollinations
5. Env-var recognition for standard API keys
6. Build pipeline fix

All tests are concrete, with exact pass criteria and adversarial checks. A terminal recording showing all 6 tests passing will serve as the PR validation.
