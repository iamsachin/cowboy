#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
NC='\033[0m'

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS] <version>

Build Cowboy, create a GitHub Release with DMG, and update the Homebrew tap.

Arguments:
  version          Semver version to release (e.g., 3.1.0)

Options:
  --build-only     Build the DMG locally without publishing
  --help           Show this help message

Examples:
  $(basename "$0") 3.1.0              # Full release
  $(basename "$0") --build-only 3.1.0 # Build DMG only
EOF
}

log() { echo -e "${GREEN}[release]${NC} $*"; }
warn() { echo -e "${YELLOW}[release]${NC} $*"; }
err() { echo -e "${RED}[release]${NC} $*" >&2; }

cleanup_hint() {
  local version="$1"
  warn "Release partially created. To clean up:"
  warn "  gh release delete v${version} --yes"
  warn "  git tag -d v${version}"
  warn "  git push origin :refs/tags/v${version}"
}

# Submit an artifact to notarytool --wait, fetch log on failure, and staple
# the ticket onto the given target. `artifact` is the submission payload
# (.zip or .dmg — notarytool does not accept a bare .app), and
# `staple_target` is the path that should receive the ticket (.app or .dmg —
# stapler cannot staple a .zip).
notarize_and_staple() {
  local artifact="$1"
  local staple_target="$2"
  local output exit_code submission_id

  log "Submitting $(basename "$artifact") for notarization (this may take a few minutes)..."
  # Temporarily disable errexit so we can capture notarytool's exit code and
  # dispatch to the failure-log fetch path instead of aborting the script.
  set +e
  output=$(xcrun notarytool submit "$artifact" --keychain-profile "$COWBOY_NOTARIZE_PROFILE" --wait 2>&1)
  exit_code=$?
  set -e
  echo "$output"

  if [[ $exit_code -ne 0 ]] || echo "$output" | grep -qi "invalid"; then
    submission_id=$(echo "$output" | grep -oE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' | head -1)
    if [[ -n "$submission_id" ]]; then
      err "Notarization failed. Fetching log..."
      xcrun notarytool log "$submission_id" --keychain-profile "$COWBOY_NOTARIZE_PROFILE" 2>&1 || true
    fi
    err "Notarization failed for $(basename "$artifact"). Check Apple Developer account and signing identity."
    exit 1
  fi
  log "Notarization successful for $(basename "$artifact")."

  log "Stapling ticket to $(basename "$staple_target")..."
  xcrun stapler staple "$staple_target"
  xcrun stapler validate "$staple_target"
}

# --- Parse arguments ---
BUILD_ONLY=false
VERSION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --build-only)
      BUILD_ONLY=true
      shift
      ;;
    -*)
      err "Unknown option: $1"
      usage
      exit 1
      ;;
    *)
      if [[ -z "$VERSION" ]]; then
        VERSION="$1"
      else
        err "Unexpected argument: $1"
        usage
        exit 1
      fi
      shift
      ;;
  esac
done

if [[ -z "$VERSION" ]]; then
  err "Version argument is required."
  usage
  exit 1
fi

# Validate semver format
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  err "Version must be in semver format (e.g., 3.1.0). Got: $VERSION"
  exit 1
fi

# --- Step 1: Check prerequisites ---
log "Checking prerequisites..."

MISSING=()
for cmd in pnpm gh cargo jq codesign xcrun; do
  if ! command -v "$cmd" &>/dev/null; then
    MISSING+=("$cmd")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  err "Missing required tools: ${MISSING[*]}"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  err "GitHub CLI not authenticated. Run: gh auth login"
  exit 1
fi

log "All prerequisites satisfied."

# Validate signing/notarization environment
if [[ -z "${APPLE_SIGN_IDENTITY:-}" ]]; then
  err "APPLE_SIGN_IDENTITY not set. Add to ~/.zshrc: export APPLE_SIGN_IDENTITY=\"Developer ID Application: Name (TEAMID)\""
  exit 1
fi
if [[ -z "${COWBOY_NOTARIZE_PROFILE:-}" ]]; then
  err "COWBOY_NOTARIZE_PROFILE not set. Add to ~/.zshrc: export COWBOY_NOTARIZE_PROFILE=\"cowboy-notarize\""
  exit 1
fi
log "Signing identity: $APPLE_SIGN_IDENTITY"

# --- Step 2: Detect architecture ---
ARCH=$(uname -m)
if [[ "$ARCH" == "arm64" ]]; then
  DMG_ARCH="aarch64"
elif [[ "$ARCH" == "x86_64" ]]; then
  DMG_ARCH="x64"
else
  warn "Unknown architecture: $ARCH. Defaulting to aarch64."
  DMG_ARCH="aarch64"
fi

DMG_NAME="Cowboy_${VERSION}_${DMG_ARCH}.dmg"
DMG_PATH="$REPO_ROOT/src-tauri/target/release/bundle/dmg/$DMG_NAME"

# --- Step 3: Build the app ---
log "Building Cowboy v${VERSION}..."
cd "$REPO_ROOT"
npx tauri build --bundles app

# --- Step 3b: Sign the .app bundle ---
APP_PATH="$REPO_ROOT/src-tauri/target/release/bundle/macos/Cowboy.app"
if [[ ! -d "$APP_PATH" ]]; then
  err "App bundle not found at: $APP_PATH"
  exit 1
fi
log "Signing Cowboy.app with hardened runtime..."
# Drop deprecated --deep; notarytool recursively inspects the bundle contents.
codesign --force --options runtime --timestamp --sign "$APPLE_SIGN_IDENTITY" "$APP_PATH"
codesign --verify --verbose "$APP_PATH"
log "App bundle signed successfully."

# --- Step 3c: Notarize and staple the .app (so the ticket travels with it into /Applications) ---
# notarytool accepts .zip/.dmg/.pkg, not a bare .app bundle, so zip first.
# `ditto -c -k --keepParent` is Apple's recommended packager (preserves xattrs and symlinks).
APP_ZIP_PATH="$REPO_ROOT/src-tauri/target/release/bundle/macos/Cowboy.zip"
rm -f "$APP_ZIP_PATH"
log "Zipping Cowboy.app for notarization submission..."
ditto -c -k --keepParent "$APP_PATH" "$APP_ZIP_PATH"
notarize_and_staple "$APP_ZIP_PATH" "$APP_PATH"
rm -f "$APP_ZIP_PATH"

# --- Step 3d: Create DMG from the now-stapled .app ---
# Stapling BEFORE DMG creation is the fix for the Homebrew quarantine issue:
# when `brew install` copies Cowboy.app into /Applications, the ticket baked
# into Contents/CodeResources travels with it, so Gatekeeper does not need
# an online check on first launch.
log "Creating DMG from signed+stapled app..."
mkdir -p "$REPO_ROOT/src-tauri/target/release/bundle/dmg"
rm -f "$DMG_PATH"
hdiutil create -volname "Cowboy" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"

# --- Step 4: Verify build output ---
if [[ ! -f "$DMG_PATH" ]]; then
  # Try the other architecture as fallback
  if [[ "$DMG_ARCH" == "aarch64" ]]; then
    FALLBACK_DMG="Cowboy_${VERSION}_x64.dmg"
  else
    FALLBACK_DMG="Cowboy_${VERSION}_aarch64.dmg"
  fi
  FALLBACK_PATH="$REPO_ROOT/src-tauri/target/release/bundle/dmg/$FALLBACK_DMG"

  if [[ -f "$FALLBACK_PATH" ]]; then
    warn "Expected $DMG_NAME but found $FALLBACK_DMG. Using fallback."
    DMG_NAME="$FALLBACK_DMG"
    DMG_PATH="$FALLBACK_PATH"
  else
    err "DMG not found at expected path: $DMG_PATH"
    err "Check src-tauri/target/release/bundle/dmg/ for available files."
    ls -la "$REPO_ROOT/src-tauri/target/release/bundle/dmg/" 2>/dev/null || true
    exit 1
  fi
fi

DMG_SIZE=$(du -h "$DMG_PATH" | cut -f1)
log "Build successful: $DMG_PATH ($DMG_SIZE)"

# --- Step 4b: Codesign, notarize, and staple the DMG ---
# Without a DMG-level signature, `spctl -a -t open --context context:primary-signature`
# rejects the DMG with "source=no usable signature" even though the .app inside is signed.
log "Signing the DMG wrapper..."
codesign --force --sign "$APPLE_SIGN_IDENTITY" --timestamp "$DMG_PATH"
codesign --verify --verbose "$DMG_PATH"
notarize_and_staple "$DMG_PATH" "$DMG_PATH"

# --- Step 5: Build-only exit ---
if [[ "$BUILD_ONLY" == true ]]; then
  echo ""
  echo -e "${BOLD}Build complete (--build-only mode)${NC}"
  echo "  DMG: $DMG_PATH"
  echo "  Size: $DMG_SIZE"
  exit 0
fi

# --- Step 6: Create GitHub Release ---
log "Creating GitHub Release v${VERSION}..."

RELEASE_NOTES=""
if [[ -f "$REPO_ROOT/CHANGELOG.md" ]]; then
  # Extract section for this version (between ## vX.Y.Z headers)
  RELEASE_NOTES=$(sed -n "/^## .*${VERSION}/,/^## /{ /^## .*${VERSION}/d; /^## /d; p; }" "$REPO_ROOT/CHANGELOG.md" | sed '/^$/N;/^\n$/d')
fi

if [[ -z "$RELEASE_NOTES" ]]; then
  RELEASE_NOTES="Cowboy v${VERSION}"
fi

if ! echo "$RELEASE_NOTES" | gh release create "v${VERSION}" \
  --title "Cowboy v${VERSION}" \
  --notes-file - \
  "$DMG_PATH"; then
  err "Failed to create GitHub Release."
  cleanup_hint "$VERSION"
  exit 1
fi

RELEASE_URL="https://github.com/iamsachin/cowboy/releases/tag/v${VERSION}"
log "GitHub Release created: $RELEASE_URL"

# --- Step 7: Update Homebrew tap ---
log "Updating Homebrew tap..."

TAP_DIR=$(mktemp -d)
trap "rm -rf $TAP_DIR" EXIT

DMG_SHA256=$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')
DMG_URL="https://github.com/iamsachin/cowboy/releases/download/v${VERSION}/${DMG_NAME}"

# Clone or create the tap repo
if gh repo view iamsachin/homebrew-cowboy &>/dev/null; then
  gh repo clone iamsachin/homebrew-cowboy "$TAP_DIR/homebrew-cowboy" -- --depth 1
else
  log "Creating Homebrew tap repo..."
  gh repo create iamsachin/homebrew-cowboy --public --description "Homebrew tap for Cowboy" --clone --add-readme
  mv iamsachin/homebrew-cowboy "$TAP_DIR/homebrew-cowboy" 2>/dev/null || \
    gh repo clone iamsachin/homebrew-cowboy "$TAP_DIR/homebrew-cowboy" -- --depth 1
fi

mkdir -p "$TAP_DIR/homebrew-cowboy/Casks"

cat > "$TAP_DIR/homebrew-cowboy/Casks/cowboy.rb" <<FORMULA
cask "cowboy" do
  version "${VERSION}"
  sha256 "${DMG_SHA256}"

  url "${DMG_URL}"
  name "Cowboy"
  desc "Track and analyze AI coding agent activity across all your projects"
  homepage "https://github.com/iamsachin/cowboy"

  app "Cowboy.app"

  zap trash: [
    "~/Library/Application Support/com.cowboy.app",
    "~/Library/Caches/com.cowboy.app",
    "~/Library/Preferences/com.cowboy.app.plist",
  ]
end
FORMULA

cd "$TAP_DIR/homebrew-cowboy"
git add -A
git commit -m "Update Cowboy to v${VERSION}" || true
git push origin main || git push origin master

log "Homebrew tap updated."

# --- Step 8: Print summary ---
echo ""
echo -e "${BOLD}=== Release Summary ===${NC}"
echo "  Version:       v${VERSION}"
echo "  GitHub Release: $RELEASE_URL"
echo "  DMG:           $DMG_PATH ($DMG_SIZE)"
echo "  SHA256:        $DMG_SHA256"
echo "  Homebrew:      brew install iamsachin/cowboy/cowboy"
echo ""
log "Release complete."
