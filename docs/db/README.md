# Database Schema Baselines

This folder stores schema-only snapshots of the remote Supabase database.

The current baseline is:

```text
schema-baseline-2026-04-27.sql
```

It was generated from the linked Supabase project after aligning migration history and applying migration `024_mission_unlock_requirements.sql`.

Generation command:

```powershell
npx supabase db dump --linked --schema public --file docs\db\schema-baseline-2026-04-27.sql
```

Use this as a structural recovery/reference snapshot. It does not include application table data.

