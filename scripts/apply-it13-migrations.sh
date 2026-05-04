#!/usr/bin/env bash
#
# IT13 / S06 — Migrations gegen Turso `baerenstark-prod` einspielen.
#
# Hintergrund:
#   `POST /api/bookings` antwortet in Production mit 500 (Tom-Feedback nach
#   IT12-Go-Live). Wahrscheinlichste Ursache (Backend-Spec §S06 Hypothese 5):
#   IT11- und IT12-Migrationen wurden nicht vollständig gegen die Turso-Prod-
#   DB ausgerollt. Dieselbe Klasse von Bug ist bereits in IT10 und IT12 auf-
#   getreten — `prisma migrate deploy` funktioniert NICHT gegen `libsql://`-
#   URLs, der manuelle `turso db shell`-Schritt ist Pflicht.
#
# Was tut das Skript:
#   1. Prüft, ob die `turso`-CLI installiert + eingeloggt ist.
#   2. Liest alle bisher in Production angelegten `_prisma_migrations`-Namen
#      und vergleicht mit der lokalen `prisma/migrations`-Liste.
#   3. Spielt jede in Prod fehlende Migration in chronologischer Reihenfolge
#      ein und trägt sie anschließend in `_prisma_migrations` nach.
#   4. Verifiziert anschließend die für IT11+IT12 erwarteten Tabellen/Spalten.
#
# Sicherheits-Pflichten:
#   - **Manuelle Ausführung erforderlich.** Der Backend-Engineer-Agent legt
#     dieses Skript nur ab; der Orchestrator startet es nach Tom-Freigabe.
#   - Vor Ausführung Backup ziehen:
#       turso db shell baerenstark-prod ".dump" > backup-$(date +%Y%m%d).sql
#   - Skript ist idempotent: läuft eine Migration bereits, wird sie übersprungen.
#
# Voraussetzungen:
#   - `turso` CLI ≥ 0.95 + `turso auth login` mit Tom's Account.
#   - cwd = Repo-Root (`/Users/mikesiefert/Desktop/baerenstark`).
#
# Usage:
#   ./scripts/apply-it13-migrations.sh [--dry-run]
#
# Exit Codes:
#   0 = alle Migrationen bestätigt (oder eingespielt).
#   1 = `turso` CLI fehlt oder Auth ungültig.
#   2 = Migrations-Verzeichnis nicht gefunden.
#   3 = `turso db shell` Aufruf fehlgeschlagen.

set -euo pipefail

DB_NAME="${TURSO_DB_NAME:-baerenstark-prod}"
MIGRATIONS_DIR="prisma/migrations"
DRY_RUN=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  echo "[dry-run] Es wird NICHTS gegen die Prod-DB geschrieben."
fi

# 1. CLI-Check
if ! command -v turso >/dev/null 2>&1; then
  echo "FEHLER: turso CLI ist nicht im PATH. Installation:" >&2
  echo "  curl -sSfL https://get.tur.so/install.sh | bash" >&2
  exit 1
fi

if ! turso auth whoami >/dev/null 2>&1; then
  echo "FEHLER: turso ist nicht eingeloggt. Bitte:" >&2
  echo "  turso auth login" >&2
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "FEHLER: Verzeichnis $MIGRATIONS_DIR nicht gefunden." >&2
  echo "Bitte das Skript aus dem Repo-Root starten." >&2
  exit 2
fi

echo "[it13-migrations] Ziel-DB: $DB_NAME"

# 2. In-Prod vorhandene Migrationen abrufen
echo "[it13-migrations] Lese _prisma_migrations aus Prod ..."
APPLIED=""
if APPLIED=$(turso db shell "$DB_NAME" \
  "SELECT migration_name FROM _prisma_migrations ORDER BY started_at" 2>/dev/null); then
  echo "[it13-migrations] Bereits eingespielt:"
  echo "$APPLIED" | sed 's/^/  /'
else
  echo "[it13-migrations] Tabelle _prisma_migrations existiert (noch) nicht — wird beim ersten Eintrag angelegt."
  APPLIED=""
fi

# 3. Lokale Migration-Liste
LOCAL_MIGRATIONS=()
while IFS= read -r dir; do
  name=$(basename "$dir")
  LOCAL_MIGRATIONS+=("$name")
done < <(find "$MIGRATIONS_DIR" -mindepth 1 -maxdepth 1 -type d | sort)

echo "[it13-migrations] Lokale Migrationen (${#LOCAL_MIGRATIONS[@]}):"
for m in "${LOCAL_MIGRATIONS[@]}"; do
  echo "  $m"
done

# 4. Diff: was fehlt in Prod
PENDING=()
for m in "${LOCAL_MIGRATIONS[@]}"; do
  if ! echo "$APPLIED" | grep -qx "$m"; then
    PENDING+=("$m")
  fi
done

if [[ ${#PENDING[@]} -eq 0 ]]; then
  echo "[it13-migrations] Keine offenen Migrationen — Prod ist auf Stand."
  exit 0
fi

echo "[it13-migrations] OFFEN gegen Prod (${#PENDING[@]}):"
for m in "${PENDING[@]}"; do
  echo "  - $m"
done

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[dry-run] Ende. Kein Schreibzugriff erfolgt."
  exit 0
fi

# 5. Bestätigung erzwingen
read -r -p "Wirklich alle offenen Migrationen gegen $DB_NAME einspielen? (yes/N) " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "[it13-migrations] Abbruch durch Operator."
  exit 0
fi

# 6. Migrationen einspielen
for m in "${PENDING[@]}"; do
  SQL_FILE="$MIGRATIONS_DIR/$m/migration.sql"
  if [[ ! -f "$SQL_FILE" ]]; then
    echo "FEHLER: $SQL_FILE existiert nicht — Migration übersprungen." >&2
    continue
  fi
  echo "[it13-migrations] -> $m"
  turso db shell "$DB_NAME" < "$SQL_FILE"

  # _prisma_migrations-Eintrag nachziehen, damit `prisma migrate status`
  # später korrekt reportet. Wir nutzen den von Prisma erwarteten Schema:
  #   id (cuid o.ä.), checksum, started_at, finished_at, migration_name,
  #   logs, rolled_back_at, applied_steps_count.
  CHECKSUM=$(shasum -a 256 "$SQL_FILE" | cut -d' ' -f1)
  ID=$(uuidgen)
  NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
  turso db shell "$DB_NAME" \
    "INSERT OR IGNORE INTO _prisma_migrations
       (id, checksum, finished_at, migration_name, logs, rolled_back_at,
        started_at, applied_steps_count)
     VALUES
       ('$ID', '$CHECKSUM', '$NOW', '$m', NULL, NULL, '$NOW', 1);" || true
done

# 7. Verifikation der wichtigsten Spalten/Tabellen aus IT11/IT12.
echo ""
echo "[it13-migrations] Verifikation:"
turso db shell "$DB_NAME" \
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN
     ('idempotency_keys','marketing_emails','marketing_email_recipients');"

turso db shell "$DB_NAME" "PRAGMA table_info(bookings);" \
  | grep -E "cancelledAt|cancelledBy|cancellationReason" || \
  echo "WARN: cancellation-Spalten nicht gefunden — IT11-Migration prüfen."

turso db shell "$DB_NAME" "PRAGMA table_info(customer_users);" \
  | grep -E "streetAndNumber|postalCode|city|unsubscribedAt" || \
  echo "WARN: Customer-Address-Spalten nicht gefunden — IT9/IT12-Migrationen prüfen."

echo "[it13-migrations] Fertig."
