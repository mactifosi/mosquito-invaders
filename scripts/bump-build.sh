#!/usr/bin/env bash
#
# Increment CURRENT_PROJECT_VERSION. App Store Connect rejects a build number
# it has already seen, so every upload needs a fresh one.

set -euo pipefail

PBXPROJ="ios/App/Caddora Games.xcodeproj/project.pbxproj"
[ -f "$PBXPROJ" ] || { echo "error: $PBXPROJ not found — run from the repo root" >&2; exit 1; }

CURRENT="$(grep -m1 -oE 'CURRENT_PROJECT_VERSION = [0-9]+' "$PBXPROJ" | grep -oE '[0-9]+')"
NEXT=$((CURRENT + 1))

sed -i '' "s/CURRENT_PROJECT_VERSION = ${CURRENT};/CURRENT_PROJECT_VERSION = ${NEXT};/g" "$PBXPROJ"
echo "build ${CURRENT} → ${NEXT}"
