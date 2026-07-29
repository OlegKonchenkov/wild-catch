-- GDPR art. 17: make "Elimina account definitivamente" actually work.
--
-- THE BUG
-- DELETE /api/profile calls `admin.auth.admin.deleteUser(user.id)` with no
-- prior cleanup. Most foreign keys pointing at auth.users were declared without
-- an ON DELETE action, which in Postgres means NO ACTION — so the delete is
-- refused as soon as the user owns a single row anywhere.
--
-- In practice that means the button worked ONLY for an account that had never
-- played. For everyone else it returned a 500 (foreign key violation) and the
-- user could not erase their data at all. The right to erasure was, in effect,
-- not implemented.
--
-- THE RULE
-- Rather than listing constraints by hand, this walks every single-column FK
-- into auth.users and picks the action from the column's nullability:
--
--   NOT NULL  -> ON DELETE CASCADE
--     The row cannot exist without the user because it IS that user's data:
--     player_sessions, player_creatures, player_inventory, encounters,
--     friendships, trades, gym_holds, group_members, and so on. Erasing the
--     account has to erase these.
--
--   NULLABLE  -> ON DELETE SET NULL
--     The row is somebody else's or nobody's, and the user is only referenced
--     as an actor: notifications.sent_by_admin_id, special_prizes.redeemed_by_admin_id,
--     session_invites.used_by_user_id, groups.created_by (the group must survive
--     its founder leaving), duels.opponent_id / winner_id.
--
-- Discovering the constraints at runtime rather than hard-coding them matters
-- here: this database has tables that exist in production but in no migration
-- (creatures.session_id and level_rewards were two, fixed in 073/076 — others
-- like player_eggs are known to have been created through Studio). A hand-written
-- list would silently miss exactly those, and they'd keep blocking deletion.
--
-- Idempotent: only constraints still on NO ACTION / RESTRICT are rewritten.

DO $$
DECLARE
  fk RECORD;
  new_action TEXT;
  changed INTEGER := 0;
BEGIN
  FOR fk IN
    SELECT
      con.conname       AS constraint_name,
      nsp.nspname       AS schema_name,
      cl.relname        AS table_name,
      att.attname       AS column_name,
      att.attnotnull    AS is_not_null
    FROM pg_constraint con
    JOIN pg_class      cl     ON cl.oid = con.conrelid
    JOIN pg_namespace  nsp    ON nsp.oid = cl.relnamespace
    JOIN pg_class      refcl  ON refcl.oid = con.confrelid
    JOIN pg_namespace  refnsp ON refnsp.oid = refcl.relnamespace
    JOIN pg_attribute  att    ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND refnsp.nspname = 'auth'
      AND refcl.relname  = 'users'
      AND nsp.nspname    = 'public'
      AND array_length(con.conkey, 1) = 1   -- composite FKs would need a bespoke fix
      AND con.confdeltype IN ('a', 'r')     -- a = NO ACTION (the default), r = RESTRICT
  LOOP
    new_action := CASE WHEN fk.is_not_null THEN 'CASCADE' ELSE 'SET NULL' END;

    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      fk.schema_name, fk.table_name, fk.constraint_name
    );
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s',
      fk.schema_name, fk.table_name, fk.constraint_name, fk.column_name, new_action
    );

    changed := changed + 1;
    RAISE NOTICE 'auth.users FK %.% (%) -> ON DELETE %',
      fk.table_name, fk.column_name, fk.constraint_name, new_action;
  END LOOP;

  RAISE NOTICE 'account deletion: % foreign key(s) rewritten', changed;
END $$;

-- Guard: after this migration nothing may still block a user delete.
DO $$
DECLARE
  blocking INTEGER;
BEGIN
  SELECT count(*) INTO blocking
  FROM pg_constraint con
  JOIN pg_class      refcl  ON refcl.oid = con.confrelid
  JOIN pg_namespace  refnsp ON refnsp.oid = refcl.relnamespace
  JOIN pg_class      cl     ON cl.oid = con.conrelid
  JOIN pg_namespace  nsp    ON nsp.oid = cl.relnamespace
  WHERE con.contype = 'f'
    AND refnsp.nspname = 'auth'
    AND refcl.relname  = 'users'
    AND nsp.nspname    = 'public'
    AND con.confdeltype IN ('a', 'r');

  IF blocking > 0 THEN
    RAISE EXCEPTION
      'GDPR art.17: % foreign key(s) into auth.users still block account deletion', blocking;
  END IF;
END $$;
