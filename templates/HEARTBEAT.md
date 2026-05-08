# HEARTBEAT.md

# Azerclaw Heartbeat Configuration
# This file controls proactive background tasks.
# The agent checks this file every 30 minutes.

## Tasks

### Git Status Check
- **Schedule**: every 30 minutes
- **Action**: Check for uncommitted changes and remind user
- **Condition**: Only if git repo detected in current directory

### Dependency Audit
- **Schedule**: daily at 09:00
- **Action**: Run `npm audit` or equivalent and report vulnerabilities
- **Condition**: Only if package.json exists

### Disk Space Monitor
- **Schedule**: every 6 hours
- **Action**: Check disk usage, warn if below 10% free
- **Condition**: Always

### Log Cleanup
- **Schedule**: weekly on Sunday
- **Action**: Rotate and compress logs older than 7 days
- **Condition**: Always
