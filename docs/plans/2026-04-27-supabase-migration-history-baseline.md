# Supabase Migration History Baseline

**Date:** 2026-04-27

## Summary

The remote Supabase project `gkbtdagxgfzliomyfzvh` (`wild-catch`) had a working schema but a mismatched migration history:

- local repo migrations were numbered `001..024`
- remote history had `001..008` plus older timestamped migration versions
- local migrations `009..024` were not marked as applied remotely

This made future `supabase db push` unsafe because the CLI could try to reconcile old local and remote-only history entries instead of applying only new work.

## What Was Done

Applied the mission unlock schema change directly to the linked remote DB:

- `missions.unlock_level INTEGER NULL`
- `missions.unlock_after_mission_id UUID NULL REFERENCES missions(id) ON DELETE SET NULL`
- verified both columns and constraints exist remotely

Then repaired Supabase migration metadata only:

- marked local migrations `009..024` as `applied`
- marked remote-only timestamped migrations as `reverted`
- verified with `supabase db push --dry-run --linked`

The final dry-run result was:

```text
Remote database is up to date.
```

No table data was reset, dropped, or rewritten. The repair changed migration history metadata, not application data.

## Backup Note

Before repairing history, the remote migration history table was exported to:

```text
supabase/.temp/migration-history-backup/schema-migrations-before-repair-20260427-133111.json
```

`supabase/.temp` is ignored by git and should remain local-only.

## Future Migration Workflow

From this point forward, create migrations with the Supabase CLI and push them normally:

```powershell
npx supabase migration new descriptive_name
npx supabase db push --dry-run --linked
npx supabase db push --linked
```

Do not manually apply SQL to remote unless there is a deliberate emergency reason. If SQL is applied manually, immediately record or repair migration history so local and remote stay aligned.

