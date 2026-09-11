#!/usr/bin/env bash
#
# Export an archive and upload it to TestFlight, without the Xcode UI.
#
# Authenticates with an App Store Connect API key, so it doesn't depend on an
# Xcode login session (those expire, and the failure is an opaque
# "DistributionAppRecordProviderError error 0" inside Organizer).
#
# Credentials come from the environment — never from this repo:
#   ASC_KEY_ID      the key's ID, e.g. 473D79CSJR
#   ASC_ISSUER_ID   the issuer UUID from App Store Connect →
#                   Users and Access → Integrations → App Store Connect API
#   ASC_KEY_PATH    optional; defaults to the standard location below
#
# Usage:  ./scripts/upload-testflight.sh ["/path/to/App.xcarchive"]
#         with no argument it takes the most recent archive.

set -euo pipefail

TEAM_ID="BSXTDBS7B2"
KEY_ID="${ASC_KEY_ID:-473D79CSJR}"
KEY_PATH="${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8}"

die() { printf '\nerror: %s\n' "$1" >&2; exit 1; }

[ -n "${ASC_ISSUER_ID:-}" ] || die "ASC_ISSUER_ID is not set.
  Find it at App Store Connect → Users and Access → Integrations →
  App Store Connect API (the 'Issuer ID' above the key table), then:
      export ASC_ISSUER_ID=<the-uuid>
  Add it to your shell profile to avoid repeating this."

[ -f "$KEY_PATH" ] || die "No API key at $KEY_PATH
  Set ASC_KEY_ID (and ASC_KEY_PATH if it lives elsewhere)."

ARCHIVE="${1:-$(ls -dt "$HOME/Library/Developer/Xcode/Archives"/*/*.xcarchive 2>/dev/null | head -1)}"
[ -d "$ARCHIVE" ] || die "No archive found. Run 'npm run archive' first."

APP_DIR="$ARCHIVE/Products/Applications"
APP="$(ls "$APP_DIR" 2>/dev/null | head -1)"
[ -n "$APP" ] || die "Archive has no app bundle: $ARCHIVE"

PLIST="$APP_DIR/$APP/Info.plist"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$PLIST")"
VERSION="$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$PLIST")"
BUILD="$(/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$PLIST")"

printf 'Uploading to TestFlight\n'
printf '  archive   %s\n' "$(basename "$ARCHIVE")"
printf '  bundle    %s\n' "$BUNDLE_ID"
printf '  version   %s (%s)\n\n' "$VERSION" "$BUILD"

OPTS="$(mktemp -t ExportOptions).plist"
cat > "$OPTS" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>upload</string>
  <key>teamID</key><string>${TEAM_ID}</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
PLIST_EOF

xcodebuild -exportArchive \
  -archivePath "$ARCHIVE" \
  -exportOptionsPlist "$OPTS" \
  -exportPath "$(mktemp -d)" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_PATH" \
  -authenticationKeyID "$KEY_ID" \
  -authenticationKeyIssuerID "$ASC_ISSUER_ID"

rm -f "$OPTS"
printf '\nUploaded. Processing takes ~5-15 minutes before it appears in TestFlight.\n'
