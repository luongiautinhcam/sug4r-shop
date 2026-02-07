#!/usr/bin/env bash
# =============================================================================
# sug4r-shop — Database Backup Script
# Usage: ./scripts/backup-db.sh
# Requires: DATABASE_URL env var or passed as argument
# =============================================================================
set -euo pipefail

DB_URL="${DATABASE_URL:-$1}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="sug4r_shop_${TIMESTAMP}.sql.gz"

if [ -z "$DB_URL" ]; then
  echo "ERROR: DATABASE_URL is required (env var or first argument)"
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup..."
echo "  Destination: ${BACKUP_DIR}/${FILENAME}"

# Dump and compress
pg_dump "$DB_URL" --no-owner --no-privileges | gzip > "${BACKUP_DIR}/${FILENAME}"

FILESIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "  Backup complete: ${FILESIZE}"

# Rotate old backups
if [ "$RETENTION_DAYS" -gt 0 ]; then
  DELETED=$(find "$BACKUP_DIR" -name "sug4r_shop_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete -print | wc -l)
  if [ "$DELETED" -gt 0 ]; then
    echo "  Cleaned up ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
  fi
fi

echo "Done."
