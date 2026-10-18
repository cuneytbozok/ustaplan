#!/usr/bin/env bash
# Weekly backup (plan §14, privacy doc §3.9): a database dump (public, auth,
# storage schemas) plus every storage object, in a dated folder outside the
# repository. Folders older than 28 days in the backup root are removed, so
# erased data leaves backups within 4 weeks.
#
#   scripts/backup.sh ~/UstaPlan-backups
#
# Needs pg_dump (brew install libpq && brew link --force libpq) and
# SUPABASE_DB_URL in .env.local (Supabase dashboard → Connect → Session pooler
# URI, with the database password). Never prints the URL.
set -euo pipefail

root="${1:?Usage: scripts/backup.sh <backup root outside the repository>}"
repo="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$root"
root="$(cd "$root" && pwd)"
case "$root/" in
  "$repo/"*) echo "Error: keep backups outside the repository (it is public)." >&2; exit 1 ;;
esac

command -v pg_dump >/dev/null || { echo "Error: pg_dump not found. Install it: brew install libpq && brew link --force libpq" >&2; exit 1; }
if [ -z "${SUPABASE_DB_URL:-}" ] && [ -f "$repo/.env.local" ]; then
  SUPABASE_DB_URL="$(grep -E '^SUPABASE_DB_URL=' "$repo/.env.local" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"
fi
[ -n "${SUPABASE_DB_URL:-}" ] || { echo "Error: SUPABASE_DB_URL is missing (.env.local). Dashboard → Connect → Session pooler URI." >&2; exit 1; }

target="$root/ustaplan-$(date +%Y-%m-%d-%H%M)"
mkdir -p "$target"
chmod 700 "$target"

pg_dump "$SUPABASE_DB_URL" --format=custom --no-owner --no-privileges \
  --schema=public --schema=auth --schema=storage --file "$target/db.dump"
echo "Database: $(du -h "$target/db.dump" | cut -f1)"

(cd "$repo" && npx tsx --env-file-if-exists=.env.local --conditions=react-server scripts/backup-storage.ts "$target/storage")

find "$root" -mindepth 1 -maxdepth 1 -type d -name 'ustaplan-*' -mtime +28 -exec rm -rf {} +
echo "Backup written to $target"
