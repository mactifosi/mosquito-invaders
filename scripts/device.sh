#!/usr/bin/env bash
#
# Build, install and launch on a connected iPhone.
#
# This is the development path: signed with a development profile, installed
# over the cable, no TestFlight processing wait. It replaces whatever is
# installed under the same bundle id — including a TestFlight build.
#
# Usage:  npm run device            # first connected iPhone
#         npm run device <udid>     # a specific one

set -euo pipefail

BUNDLE_ID="com.caddora.games"
PROJECT="Caddora Games.xcodeproj"
SCHEME="Caddora Games"
DERIVED="${TMPDIR:-/tmp}/caddora-device-build"

die() { printf '\nerror: %s\n' "$1" >&2; exit 1; }

# Device names contain spaces, so the UDID is found by shape rather than by
# column. A cabled phone reports "connected"; one paired over the network
# reports "available", and devicectl can reach that too — prefer the cable.
# `|| true` matters: no match makes grep exit 1, which under `set -e` would
# abort the script during the first (cabled) lookup instead of falling through
# to the second.
pick_udid() {
  xcrun devicectl list devices 2>/dev/null \
    | grep -i iphone | grep -i "$1" | head -1 \
    | grep -oE '[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}' | head -1 || true
}

UDID="${1:-}"
[ -n "$UDID" ] || UDID="$(pick_udid connected)"
[ -n "$UDID" ] || UDID="$(pick_udid available)"
[ -n "$UDID" ] || die "No iPhone found, connected or paired.
  Plug one in and unlock it, then try again — or pass a UDID:
      npm run device <udid>
  List what's visible with: xcrun devicectl list devices"

printf 'Building for %s\n\n' "$UDID"

cd ios/App
xcodebuild \
  -project "$PROJECT" \
  -scheme "$SCHEME" \
  -configuration Debug \
  -destination "id=$UDID" \
  -derivedDataPath "$DERIVED" \
  -allowProvisioningUpdates \
  build 2>&1 | tee "${TMPDIR:-/tmp}/caddora-device-build.log" \
  | grep -E "BUILD (SUCCEEDED|FAILED)|error:" || true

APP="$(find "$DERIVED/Build/Products" -maxdepth 2 -name "*.app" -path "*iphoneos*" | head -1)"
if [ -z "$APP" ]; then
  if grep -q "may need to be unlocked" "${TMPDIR:-/tmp}/caddora-device-build.log"; then
    die "The iPhone is locked. Unlock it (and keep it awake), then run this again."
  fi
  die "Build produced no .app. Full log: ${TMPDIR:-/tmp}/caddora-device-build.log"
fi

printf '\nInstalling %s\n' "$(basename "$APP")"
xcrun devicectl device install app --device "$UDID" "$APP" >/dev/null
xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID" >/dev/null

printf 'Launched on the device.\n'
