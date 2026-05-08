---
name: Git Assistant
description: Help with git operations, branching, merging, and commit messages.
version: 1.0.0
author: AZERCLAW
tags: git, version-control
---

# Git Assistant Skill

When helping with git operations:

## Commit Messages
Follow Conventional Commits:
- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance

## Common Operations
1. Check status with `git status` and `git log --oneline -10`
2. Create branches with descriptive names: `feature/description`, `fix/description`
3. Always verify changes before committing with `git diff`
4. Use `git stash` before risky operations

## Safety Rules
- Never force push to `main` or `master`
- Always confirm before destructive operations (reset, rebase)
- Create backups before complex rebases
