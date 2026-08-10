# Backend operations runbook

## Automatic PostgreSQL backup on Windows Task Scheduler

This project does not create a scheduled task automatically. Set it up manually on the Windows server or workstation that owns the database.

Recommended approach:

1. Save backups to a dedicated folder, for example `D:\PhelieuWeb\backups`.
2. Make sure PostgreSQL client tools are installed so `pg_dump.exe` is available.
3. Run the script first in dry-run mode to confirm the path and connection string.
4. Create a Task Scheduler task that starts PowerShell and calls `backend\backup-postgres.ps1` with `-RunBackup`.
5. Store the database URL in an environment variable or pass it explicitly in the task.
6. Verify the task writes one `.dump` file per run and that old backups are rotated by your own retention policy.

Suggested task settings:

- Trigger: daily, before business hours.
- Action: start `powershell.exe`.
- Arguments: `-ExecutionPolicy Bypass -File "D:\PhelieuWeb\backend\backup-postgres.ps1" -RunBackup -OutputDirectory "D:\PhelieuWeb\backups"`
- Start in: `D:\PhelieuWeb`
- Run whether user is logged on or not.
- Run with highest privileges if the database or backup folder requires it.

Validation checklist for the task:

- The task runs without prompts.
- The backup file is created in the expected folder.
- The file opens with your PostgreSQL restore tooling.
- The backup time is logged somewhere external, such as Task Scheduler history or a separate ops log.

## Deploy checklist

- Backup completed successfully before deploy.
- Migration SQL and rollback SQL reviewed.
- Test environment validated with the same migration version.
- No app source changes slipped in outside the approved scope.
- Production deploy window confirmed.
- Post-deploy smoke test prepared.
- Rollback path documented and backup location verified.

## Manual restore reminder

If you need to recover, restore from the most recent backup first, then re-run only the migrations that are still intended for the target environment. Do not assume a rollback script can reconstruct deleted business data.
