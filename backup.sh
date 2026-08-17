#!/bin/bash
BACKUP_DIR="/opt/visitor-mgmt-abatplus/backups"
ENV_FILE="/opt/visitor-mgmt-abatplus/backend/.env"
UPLOADS_DIR="/opt/visitor-mgmt-abatplus/backend/uploads"
KEEP_DAYS=30
DATE=$(date +%Y-%m-%d)

get_env() { grep -E "^${1}=" "$ENV_FILE" | tail -1 | cut -d '=' -f2-; }
DB_HOST=$(get_env DB_HOST)
DB_PORT=$(get_env DB_PORT)
DB_USER=$(get_env DB_USER)
DB_PASSWORD=$(get_env DB_PASSWORD)
DB_NAME=$(get_env DB_NAME)

mkdir -p "$BACKUP_DIR"

OUT_FILE="${BACKUP_DIR}/visitors-${DATE}.sql.gz"

MYSQL_PWD="$DB_PASSWORD" mysqldump \
  --single-transaction --routines --triggers \
  -h "${DB_HOST:-127.0.0.1}" -P "${DB_PORT:-3306}" -u "$DB_USER" "$DB_NAME" \
  | gzip > "$OUT_FILE"

if [ $? -eq 0 ]; then
  echo "[backup] visitors-${DATE}.sql.gz erstellt"
else
  echo "[backup] FEHLER beim Backup" >&2
  rm -f "$OUT_FILE"
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

find "$BACKUP_DIR" -name "visitors-*.sql.gz" -mtime +${KEEP_DAYS} -delete
find "$BACKUP_DIR" -name "uploads-*.tar.gz" -mtime +${KEEP_DAYS} -delete
echo "[backup] Alte Backups (>${KEEP_DAYS} Tage) bereinigt"
