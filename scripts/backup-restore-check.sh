#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
RESTORE_DB_URL="${RESTORE_DB_URL:-$DATABASE_URL}"
BACKUP_FILE="${BACKUP_FILE:-backup_check.dump}"

echo "[1/4] Creating backup: $BACKUP_FILE"
pg_dump --format=custom --no-owner --no-privileges --dbname "$DATABASE_URL" --file "$BACKUP_FILE"

echo "[2/4] Restoring backup into target DB"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$RESTORE_DB_URL" "$BACKUP_FILE"

echo "[3/4] Running post-restore smoke query"
psql "$RESTORE_DB_URL" -c "SELECT 1 AS restore_ok;"

echo "[4/4] Backup/restore check completed successfully"
