#!/usr/bin/env bash
# Apply every migration to a throwaway local Postgres 16 (+pgvector) and run the SQL test files.
# Usage: tests/db/run-local.sh [test.sql ...]   (default: tests/db/*.test.sql)
# Requires: postgresql-16, postgresql-16-pgvector. Never touches a remote database.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PGBIN=/usr/lib/postgresql/16/bin
PORT="${LOCAL_PG_PORT:-54329}"
DATA="$(mktemp -d /tmp/jadarah-pg-XXXXXX)"
EXT=/usr/share/postgresql/16/extension
LIB=/usr/lib/postgresql/16/lib

as_pg() { if [ "$(id -u)" = 0 ]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }

# pg_cron is not packaged here: install a no-op stand-in extension (schedule() just records the job).
if [ ! -f "$EXT/pg_cron.control" ]; then
  cat > "$EXT/pg_cron.control" <<'EOF'
comment = 'local no-op stand-in for pg_cron (tests only)'
default_version = '1.0'
relocatable = false
EOF
  cat > "$EXT/pg_cron--1.0.sql" <<'EOF'
create schema if not exists cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create function cron.unschedule(job_name text) returns boolean language sql as $$
  with d as (delete from cron.job where jobname = job_name returning 1) select exists (select 1 from d) $$;
EOF
fi

chown postgres "$DATA" 2>/dev/null || true
as_pg "$PGBIN/initdb -D $DATA -A trust -U postgres >/dev/null"
as_pg "$PGBIN/pg_ctl -D $DATA -o '-p $PORT -k /tmp' -l $DATA/log -w start >/dev/null"
trap 'as_pg "$PGBIN/pg_ctl -D $DATA -m immediate stop >/dev/null" || true; rm -rf "$DATA"' EXIT

export PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql -h /tmp -p "$PORT" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X)
"${PSQL[@]}" -f "$ROOT/tests/db/supabase-shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  "${PSQL[@]}" -f "$f" >/dev/null || { echo "MIGRATION FAILED: $(basename "$f")"; exit 1; }
done
# Fictional demo data (local only; random throwaway password).
"${PSQL[@]}" -f "$ROOT/supabase/seed/demo_seed.sql" >/dev/null
"${PSQL[@]}" -c "select public.seed_demo('local-only-' || md5(random()::text))" >/dev/null && echo "demo seed loaded" 
echo "migrations applied: $(ls "$ROOT"/supabase/migrations/*.sql | wc -l)"

TESTS=("$@")
[ ${#TESTS[@]} -eq 0 ] && TESTS=("$ROOT"/tests/db/*.test.sql)
fail=0
for t in "${TESTS[@]}"; do
  [ -f "$t" ] || continue
  if out=$("${PSQL[@]}" -f "$t" 2>&1); then
    echo "PASS $(basename "$t")"; [ -n "${VERBOSE:-}" ] && echo "$out"
  else
    echo "FAIL $(basename "$t")"; echo "$out" | tail -20; fail=1
  fi
done
exit $fail
