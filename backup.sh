#!/bin/bash
BACKUP_DIR="/opt/visitor-mgmt-abatplus/backups"
ENV_FILE="/opt/visitor-mgmt-abatplus/backend/.env"
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

find "$BACKUP_DIR" -name "visitors-*.dump" -mtime +${KEEP_DAYS} -delete
echo "[backup] Alte Backups (>${KEEP_DAYS} Tage) bereinigt"
