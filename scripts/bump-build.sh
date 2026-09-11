#!/usr/bin/env bash
#
# Increment CURRENT_PROJECT_VERSION.
#
# Run *after* a successful upload, not before one: the invariant is that the
# number in the project is the next one not yet uploaded. Bumping first meant
# any archive or upload that failed still burned a number — build 6 was lost
# that way and the sequence jumped 5 → 7.

set -euo pipefail

PBXPROJ="ios/App/Caddora Games.xcodeproj/project.pbxproj"
[ -f "$PBXPROJ" ] || { echo "error: $PBXPROJ not found — run from the repo root" >&2; exit 1; }

CURRENT="$(grep -m1 -oE 'CURRENT_PROJECT_VERSION = [0-9]+' "$PBXPROJ" | grep -oE '[0-9]+')"
NEXT=$((CURRENT + 1))

sed -i '' "s/CURRENT_PROJECT_VERSION = ${CURRENT};/CURRENT_PROJECT_VERSION = ${NEXT};/g" "$PBXPROJ"
echo "build ${CURRENT} → ${NEXT}"
