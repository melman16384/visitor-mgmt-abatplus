#!/bin/bash
BACKUP_DIR="/opt/visitor-mgmt-abatplus/backups"
ENV_FILE="/opt/visitor-mgmt-abatplus/backend/.env"
UPLOADS_DIR="/opt/visitor-mgmt-abatplus/backend/uploads"
KEEP_DAYS=30
DATE=$(date +%Y-%m-%d)

set -a
source "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"

PGPASSWORD="$PG_PASSWORD" pg_dump -h "${PG_HOST:-127.0.0.1}" -p "${PG_PORT:-5432}" \
  -U "$PG_USER" -d "$PG_DATABASE" -F c -f "${BACKUP_DIR}/visitors-${DATE}.dump"

if [ $? -eq 0 ]; then
  echo "[backup] visitors-${DATE}.dump erstellt"
else
  echo "[backup] FEHLER beim Backup" >&2
  exit 1
fi

if [ -d "$UPLOADS_DIR" ]; then
  tar -czf "${BACKUP_DIR}/uploads-${DATE}.tar.gz" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
  if [ $? -eq 0 ]; then
    echo "[backup] uploads-${DATE}.tar.gz erstellt"
  else
    echo "[backup] FEHLER beim Uploads-Backup" >&2
    exit 1
  fi
fi

find "$BACKUP_DIR" -name "visitors-*.dump" -mtime +${KEEP_DAYS} -delete
find "$BACKUP_DIR" -name "uploads-*.tar.gz" -mtime +${KEEP_DAYS} -delete
echo "[backup] Alte Backups (>${KEEP_DAYS} Tage) bereinigt"
