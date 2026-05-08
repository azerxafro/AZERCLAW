---
name: Code Review
description: Review code for bugs, security issues, best practices, and style.
version: 1.0.0
author: AZERCLAW
tags: code, review, quality
---

# Code Review Skill

When asked to review code, follow this structured approach:

## Process

1. **Read the file(s)** using `read_file`
2. **Analyze** for the following categories:
   - 🐛 **Bugs**: Logic errors, off-by-one, null references, race conditions
   - 🔒 **Security**: Injection, XSS, auth issues, exposed secrets, SSRF
   - ⚡ **Performance**: N+1 queries, unnecessary loops, memory leaks
   - 📐 **Style**: Naming conventions, code organization, readability
   - 🧪 **Testing**: Missing edge cases, untested paths

3. **Format findings** with severity levels:
   - 🔴 CRITICAL — Must fix before merge
   - 🟡 WARNING — Should fix soon
   - 🔵 INFO — Suggestion for improvement

4. **Provide fixes** — Don't just identify, suggest or implement solutions.

## Output Format

```
## Code Review: [filename]

### Summary
[1-2 sentence overview]

### Findings

🔴 CRITICAL: [description]
  File: [path]:[line]
  Fix: [suggested fix]

🟡 WARNING: [description]
  ...
```
