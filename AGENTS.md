# Agent Instructions — Commercial Version

PROJECT MODE: COMMERCIALIZATION

This worktree/branch is the commercial version of the Attendance platform.

Git branch:
commercial

The `main` branch is the currently deployed workshop/live version.

## Core Rules:
1. Never modify or switch `main` for commercialization tasks.
2. Never deploy to the existing workshop VPS unless explicitly requested.
3. Do not rebuild the Attendance application from zero.
4. Preserve the existing business logic and architecture unless a change is explicitly approved.
5. Make commercialization changes incrementally.
6. Run tests/build after meaningful changes.
7. Create clear Git commits after approved phases.
8. Never expose or commit passwords, API keys, JWT secrets, database passwords, SSH credentials or production secrets.
9. Never force-push.
10. Never merge commercial into main without explicit user approval.
