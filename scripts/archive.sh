#!/usr/bin/env bash
#
# Archive the current build for distribution. The build number is whatever the
# project currently says — see scripts/bump-build.sh for why that's the number
# that hasn't been uploaded yet.

set -euo pipefail

PROJECT="ios/App/Caddora Games.xcodeproj"
SCHEME="Caddora Games"
[ -d "$PROJECT" ] || { echo "error: run from the repo root" >&2; exit 1; }

BUILD="$(grep -m1 -oE 'CURRENT_PROJECT_VERSION = [0-9]+' "$PROJECT/project.pbxproj" | grep -oE '[0-9]+')"
DEST="$HOME/Library/Developer/Xcode/Archives/$(date +%Y-%m-%d)/CaddoraGames $(date '+%d-%m-%Y, %H.%M').xcarchive"

printf 'Archiving build %s\n\n' "$BUILD"

cd ios/App
xcodebuild \
  -project "Caddora Games.xcodeproj" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$DEST" \
  archive \
  -allowProvisioningUpdates

printf '\nArchived: %s\n' "$(basename "$DEST")"
