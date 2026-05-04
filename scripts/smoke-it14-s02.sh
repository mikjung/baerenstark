#!/usr/bin/env bash
#
# IT14 / US-IT14-S02 — Auth-Gate Smoke-Test.
#
# Prüft die drei kanonischen Defense-in-Depth-Szenarien:
#   1. /admin ohne Cookie → 302 Redirect auf /admin/login.
#   2. /api/admin/bookings ohne Cookie → 401 JSON
#      `{ "error": { "code": "UNAUTHORIZED", "message": "Bitte einloggen." } }`.
#   3. /admin mit gefälschtem Cookie → 302 Redirect (kein 200, kein HTML-Leak).
#
# Public-Pfade (Whitelist) müssen weiterhin erreichbar sein:
#   4. /admin/login → 200 (Public).
#   5. /api/admin/setup → 200 oder 4xx (Public, je nach DB-Zustand).
#
# Default-Host: localhost:3000. Override via env-Variable BASE_URL.
#
# Usage:
#   bash scripts/smoke-it14-s02.sh
#   BASE_URL=https://www.baerenstark-hausservice.app bash scripts/smoke-it14-s02.sh
#

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"

PASS=0
FAIL=0

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  PASS  $label (got $actual)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label (expected $expected, got $actual)"
    FAIL=$((FAIL + 1))
  fi
}

contains() {
  local label="$1"
  local needle="$2"
  local haystack="$3"
  if [[ "$haystack" == *"$needle"* ]]; then
    echo "  PASS  $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label (output did not contain: $needle)"
    echo "        body: $haystack"
    FAIL=$((FAIL + 1))
  fi
}

echo "Bärenstark IT14-S02 Smoke ($BASE_URL)"
echo

# --- 1. /admin ohne Cookie → 302 ---
status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/admin")
check "/admin ohne Cookie → 302" "302" "$status"

# --- 2. /api/admin/bookings ohne Cookie → 401 + JSON ---
resp=$(curl -s -w '\n--HTTP-%{http_code}--' "$BASE_URL/api/admin/bookings")
http=$(echo "$resp" | tail -n1 | sed 's/--HTTP-//; s/--//')
body=$(echo "$resp" | sed '$d')
check "/api/admin/bookings ohne Cookie → 401" "401" "$http"
contains "/api/admin/bookings — JSON enthält UNAUTHORIZED" "UNAUTHORIZED" "$body"
contains "/api/admin/bookings — deutsche Botschaft" "Bitte einloggen" "$body"

# --- 3. /admin mit gefälschtem Cookie → 302 ---
status=$(curl -s -o /dev/null -w '%{http_code}' \
  -H 'Cookie: __Secure-next-auth.session-token=invalid; next-auth.session-token=invalid' \
  "$BASE_URL/admin")
check "/admin mit invalidem Cookie → 302" "302" "$status"

# --- 4. /admin/login → 200 (Public-Whitelist) ---
status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/admin/login")
check "/admin/login (Public) → 200" "200" "$status"

# --- 5. /api/admin/setup → nicht 401 (Public-Whitelist) ---
status=$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/admin/setup")
if [[ "$status" == "401" ]]; then
  echo "  FAIL  /api/admin/setup (Public) — 401 ist nicht erlaubt"
  FAIL=$((FAIL + 1))
else
  echo "  PASS  /api/admin/setup (Public) → $status (kein 401)"
  PASS=$((PASS + 1))
fi

# --- 6. /api/admin/forgot-password → nicht 401 (Public-Whitelist) ---
status=$(curl -s -o /dev/null -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' -d '{}' \
  "$BASE_URL/api/admin/forgot-password")
if [[ "$status" == "401" ]]; then
  echo "  FAIL  /api/admin/forgot-password (Public) — 401 ist nicht erlaubt"
  FAIL=$((FAIL + 1))
else
  echo "  PASS  /api/admin/forgot-password (Public) → $status (kein 401)"
  PASS=$((PASS + 1))
fi

echo
echo "PASS=$PASS  FAIL=$FAIL"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
exit 0
