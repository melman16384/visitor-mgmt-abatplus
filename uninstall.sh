#!/bin/bash
# Deinstallation der abat+ Besucherverwaltung.
#
# Entfernt NUR Artefakte dieses Projekts — rührt keine anderen Apps auf dem
# Server an (pm2-Einträge, Cron-Zeilen, Nginx-Sites werden gezielt gefiltert,
# nicht pauschal gelöscht). Muss als root laufen. Interaktiv: fragt vor jedem
# unwiderruflichen Schritt einmal nach, zusätzlich vor dem allerletzten
# (Projektverzeichnis + DB löschen) eine Tipp-Bestätigung.
#
# Nutzung:
#   sudo /opt/visitor-mgmt-abatplus/uninstall.sh            # interaktiv
#   sudo /opt/visitor-mgmt-abatplus/uninstall.sh --dry-run  # nur anzeigen, nichts ändern
#   sudo /opt/visitor-mgmt-abatplus/uninstall.sh --yes      # ohne Rückfragen (Vorsicht!)

set -euo pipefail

PROJECT_DIR="/opt/visitor-mgmt-abatplus"
APP_NAME="visitor-mgmt-abatplus"
SYS_USER="svc-visitormgmtplus"
NGINX_SITE="visitorplus.luwilab.work"
SSL_DIR="/etc/ssl/visitorplus"
CRON_FILE="/etc/cron.d/visitor-mgmt-backups"
DB_NAME="visitormgmt_abatplus"
DB_ROLE="visitormgmt_abatplus"
ECOSYSTEM_FILE="/opt/ecosystem.config.js"

DRY_RUN=false
ASSUME_YES=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --yes) ASSUME_YES=true ;;
    *) echo "Unbekannte Option: $arg" >&2; exit 1 ;;
  esac
done

if [ "$EUID" -ne 0 ]; then
  echo "Bitte als root ausführen (sudo)." >&2
  exit 1
fi

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    eval "$@"
  fi
}

confirm() {
  $ASSUME_YES && return 0
  read -r -p "$1 [j/N] " reply
  [[ "$reply" =~ ^[jJ]$ ]]
}

echo "=== Deinstallation: abat+ Besucherverwaltung ($PROJECT_DIR) ==="
$DRY_RUN && echo "(Dry-Run — es wird nichts verändert)"
echo

# 1. pm2-Prozess stoppen und entfernen (nur dieser App-Eintrag)
if confirm "pm2-Prozess '$APP_NAME' stoppen und entfernen?"; then
  run "pm2 delete '$APP_NAME' 2>/dev/null || true"
  run "pm2 save"
  echo "→ Prozess entfernt. WICHTIG: Eintrag für '$APP_NAME' manuell aus"
  echo "  $ECOSYSTEM_FILE löschen (Datei wird von mehreren Apps geteilt —"
  echo "  hier bewusst kein automatisches Sed/Regex-Löschen, um andere"
  echo "  Einträge nicht zu riskieren)."
fi
echo

# 2. Nginx-Site entfernen
if confirm "Nginx-Site '$NGINX_SITE' entfernen?"; then
  run "rm -f /etc/nginx/sites-enabled/$NGINX_SITE"
  run "rm -f /etc/nginx/sites-available/$NGINX_SITE"
  run "nginx -t && systemctl reload nginx"
fi
echo

# 3. SSL-Zertifikat entfernen
if confirm "SSL-Zertifikat unter $SSL_DIR entfernen?"; then
  run "rm -rf '$SSL_DIR'"
fi
echo

# 4. Cron-Backup-Job entfernen (nur die abatplus-Zeile — Datei ist mit visitor-mgmt geteilt)
if [ -f "$CRON_FILE" ] && grep -q "$PROJECT_DIR" "$CRON_FILE"; then
  if confirm "Backup-Cron-Eintrag für abatplus aus $CRON_FILE entfernen (visitor-mgmt-Zeile bleibt erhalten)?"; then
    run "sed -i '\|$PROJECT_DIR|d' '$CRON_FILE'"
  fi
fi
echo

# 5. Datenbank sichern + löschen
if confirm "Letztes DB-Backup vor dem Löschen erstellen ($PROJECT_DIR/backups)?"; then
  run "$PROJECT_DIR/backup.sh || echo 'Backup fehlgeschlagen — Skript prüfen, bevor weitergemacht wird!'"
fi
if confirm "PostgreSQL-Datenbank '$DB_NAME' und Rolle '$DB_ROLE' UNWIDERRUFLICH löschen?"; then
  run "sudo -u postgres dropdb --if-exists '$DB_NAME'"
  run "sudo -u postgres dropuser --if-exists '$DB_ROLE'"
fi
echo

# 6. Systembenutzer entfernen
if id "$SYS_USER" &>/dev/null; then
  if confirm "Systembenutzer '$SYS_USER' entfernen?"; then
    run "userdel '$SYS_USER' 2>/dev/null || true"
  fi
fi
echo

# 7. pm2-Logs entfernen
if confirm "pm2-Logdateien für '$APP_NAME' entfernen?"; then
  run "rm -f /root/.pm2/logs/${APP_NAME}-out.log /root/.pm2/logs/${APP_NAME}-error.log"
fi
echo

# 8. Projektverzeichnis löschen — letzter, größter Schritt
echo "Letzter Schritt: Projektverzeichnis $PROJECT_DIR (Code, .env, Backups, Uploads, Logs) endgültig löschen."
if ! $ASSUME_YES; then
  read -r -p "Zum Bestätigen exakt 'DEINSTALLIEREN' eingeben: " typed
  if [ "$typed" != "DEINSTALLIEREN" ]; then
    echo "Abgebrochen — Projektverzeichnis bleibt erhalten."
    exit 0
  fi
fi
run "rm -rf '$PROJECT_DIR'"

echo
echo "=== Fertig. ==="
echo "Nicht automatisch entfernt (bewusst, da geteilte/externe Ressourcen):"
echo "  - Eintrag '$APP_NAME' in $ECOSYSTEM_FILE (manuell löschen)"
echo "  - Azure App Registration (Azure Portal → Microsoft Entra ID → App-Registrierungen)"
echo "  - Cloudflare DNS-Eintrag für $NGINX_SITE"
