#!/usr/bin/env bash
# =============================================================================
# sug4r-shop — Database Restore Script
# Usage: ./scripts/restore-db.sh <backup-file.sql.gz>
# WARNING: This will DROP and recreate all tables!
# =============================================================================
set -euo pipefail

BACKUP_FILE="${1:-}"
DB_URL="${DATABASE_URL:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file path is required"
  echo "Usage: ./scripts/restore-db.sh backups/sug4r_shop_YYYYMMDD_HHMMSS.sql.gz"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: File not found: $BACKUP_FILE"
  exit 1
fi

if [ -z "$DB_URL" ]; then
  echo "ERROR: DATABASE_URL is required"
  exit 1
fi

echo "=== WARNING ==="
echo "This will OVERWRITE the current database with the backup."
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Type 'yes' to confirm: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring from ${BACKUP_FILE}..."

gunzip -c "$BACKUP_FILE" | psql "$DB_URL" --quiet

echo "Restore complete."
echo "IMPORTANT: Verify the data is correct before resuming the application."
