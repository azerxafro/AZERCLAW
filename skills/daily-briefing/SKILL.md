---
name: Daily Briefing
description: Generate a daily summary of project status, git activity, and tasks.
version: 1.0.0
author: AZERCLAW
tags: productivity, summary, briefing
---

# Daily Briefing Skill

Generate a comprehensive daily briefing:

## Data Collection
1. Run `git log --since="24 hours ago" --oneline` for recent commits
2. Run `git diff --stat HEAD~5` for recent changes summary
3. Check for TODO/FIXME comments: `grep -rnI "TODO\|FIXME\|HACK\|XXX" . --include="*.ts" --include="*.js" --include="*.py" | head -20`
4. Check for any failing tests if test script exists

## Report Format
```
📊 Daily Briefing — [date]
═══════════════════════════

📝 Recent Commits (24h): [count]
[list top 5]

📁 Files Changed: [count]
[summary]

⚠️ TODOs/FIXMEs: [count]
[top 5]

🎯 Suggested Focus Areas:
[based on analysis]
```
