<div align="center">

```
     █████╗ ███████╗███████╗██████╗  ██████╗██╗      █████╗ ██╗    ██╗
    ██╔══██╗╚══███╔╝██╔════╝██╔══██╗██╔════╝██║     ██╔══██╗██║    ██║
    ███████║  ███╔╝ █████╗  ██████╔╝██║     ██║     ███████║██║ █╗ ██║
    ██╔══██║ ███╔╝  ██╔══╝  ██╔══██╗██║     ██║     ██╔══██║██║███╗██║
    ██║  ██║███████╗███████╗██║  ██║╚██████╗███████╗██║  ██║╚███╔███╔╝
    ╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝╚═╝  ╚═╝ ╚══╝╚══╝
```

**🐟 Your AI · Your Keys · Your Way**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org)
[![BYOK](https://img.shields.io/badge/BYOK-Bring%20Your%20Own%20Key-purple.svg)](#-byok-providers)

*An open-source, BYOK autonomous AI agent for your terminal.*
*Inspired by OpenClaw 🦞, powered by a fish 🐟.*

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔑 **BYOK** | Bring Your Own Key — zero platform fees, use any provider |
| 🤖 **Autonomous Agent** | Multi-step task execution with tool use |
| 🐠 **Sub-Agents** | Spawn parallel agents for complex workloads |
| 🐟 **Fish CLI** | Animated ASCII fish instead of a lobster |
| 🖥️ **Premium TUI** | Luxe terminal UI with status bar & panels |
| 🔧 **8 Built-in Tools** | Shell, filesystem, search, code analysis, web |
| 📦 **Skills System** | SKILL.md compatible, extensible capabilities |
| 🔒 **Security First** | AES-256-GCM key encryption, zero telemetry |
| 🌐 **8 Providers** | OpenAI, Anthropic, Google, Ollama, Groq, DeepSeek, OpenRouter, Custom |
| 💻 **Cross-Platform** | macOS (Intel + Silicon), Windows, Linux |

## 🚀 Quick Start

```bash
# Clone
git clone https://github.com/azerclaw/azerclaw.git
cd azerclaw

# Install
npm install

# First run — launches setup wizard with animated splash
npx tsx bin/azerclaw.ts

# Or use npm scripts
npm start           # Launch TUI
npm run chat        # Interactive chat
npm run doctor      # Health check
```

## 📸 Preview

```
  ><(((º>  AZERCLAW v1.0.0
  Your AI · Your Keys · Your Way

  ╭──────────────────────────────────────────────────────────╮
  │                    🩺 AZERCLAW Doctor                    │
  │──────────────────────────────────────────────────────────│
  │ Running health checks...                                 │
  ╰──────────────────────────────────────────────────────────╯

  ═══════════════════════════════════════><(((º> 100% System

  ✓ Config File      Found at ~/.azerclaw/config.json
  ✓ Directories      All present
  ✓ Permissions      Config is 0600 (secure)
  ✓ Providers        1 configured: openrouter
  ✓ Connectivity     1 providers initialized
  ✓ Node.js          v22.0.0
  ✓ System           darwin arm64 | 10 cores | 16GB RAM

  ><(((°>  ✓ All 7 checks passed! 🐟
```

## 🔑 BYOK Providers

| Provider | Models | How to Get Key |
|---|---|---|
| **OpenAI** | GPT-4o, GPT-4.1, o3, o4-mini | [platform.openai.com](https://platform.openai.com) |
| **Anthropic** | Claude Opus 4, Sonnet 4, Haiku | [console.anthropic.com](https://console.anthropic.com) |
| **Google** | Gemini 2.5 Pro/Flash | [aistudio.google.com](https://aistudio.google.com) |
| **Groq** | Llama 3.3, Mixtral | [console.groq.com](https://console.groq.com) |
| **DeepSeek** | DeepSeek V3, R1 | [platform.deepseek.com](https://platform.deepseek.com) |
| **OpenRouter** | 100+ models | [openrouter.ai](https://openrouter.ai) |
| **Ollama** | Any local model | [ollama.ai](https://ollama.ai) |
| **Custom** | Any OpenAI-compatible | Your own endpoint |

```bash
# Configure via CLI
azerclaw config set ai.providers.openrouter.apiKey "sk-or-..."
azerclaw config set ai.providers.openrouter.enabled true
azerclaw config set ai.defaultProvider openrouter

# Or use the interactive wizard
azerclaw onboard

# Or use environment variables
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."
```

## 🎮 Commands

```bash
azerclaw                    # Launch TUI (or onboard if first run)
azerclaw chat               # Interactive chat
azerclaw run "task"          # Execute a single task
azerclaw tui                # Premium terminal UI
azerclaw onboard            # Setup wizard
azerclaw config list        # Show configuration
azerclaw config get <key>   # Get a config value
azerclaw config set <k> <v> # Set a config value
azerclaw models list        # List available models
azerclaw models status      # Current model info
azerclaw doctor             # Health check
azerclaw doctor --fix       # Auto-repair issues
azerclaw security audit     # Security check
```

## 🐟 Fish Animations

AZERCLAW replaces OpenClaw's lobster 🦞 with a fish 🐟:

```
Thinking:   ><(((º>  ○ ○   Working...
Success:    ><(((°>  ✓ Done!
Error:      ><(((x>  ✗ Failed!
Progress:   ═══════><(((º>░░░░░  67%
```

## 🤖 Agent & Sub-Agents

AZERCLAW uses an autonomous agent loop with sub-agent orchestration:

```
┌──────────────────────────┐
│      Main Agent          │
│  (receives user task)    │
├──────────────────────────┤
│  ↓ Thinks & Plans        │
│  ↓ Uses Tools            │
│  ↓ Spawns Sub-Agents     │
│                          │
│  ┌────────┐ ┌────────┐   │
│  │Sub 🐠 A│ │Sub 🐠 B│   │
│  │Research│ │ Code   │   │
│  └────────┘ └────────┘   │
│                          │
│  ↓ Aggregates Results    │
│  ↓ Returns Response      │
└──────────────────────────┘
```

## 🔒 Security

- **Zero telemetry** — no data ever leaves your machine
- **No analytics** — we don't track anything
- **No phone-home** — no background network requests
- **AES-256-GCM** — API keys encrypted at rest
- **0600 permissions** — config files owner-only
- **Audit logging** — local security event log
- **Env sanitization** — sensitive vars stripped from child processes
- **SSRF protection** — blocks requests to private/internal IPs

## 📦 Skills System

Skills are SKILL.md files compatible with the OpenClaw ecosystem:

```markdown
---
name: Code Review
description: Review code for bugs and security issues
version: 1.0.0
tags: code, review
---

# Code Review Skill
When asked to review code...
```

Skills load from (priority order):
1. `<workspace>/skills/` — Project-specific
2. `~/.agents/skills/` — Personal
3. `~/.azerclaw/skills/` — Managed
4. `<install>/skills/` — Bundled defaults

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build
npm run build

# Run doctor
npm run doctor
```

## 📄 License

MIT — Free and open source forever.

---

<div align="center">

**🐟 AZERCLAW — Your AI, Your Keys, Your Way**

</div>
