#!/usr/bin/env bash
# ============================================================================
# U.L.T.R.O.N. Universal Neural Client Installer for macOS & Linux
# ============================================================================

set -e

REPO_OWNER="mark816p"
REPO_NAME="ULTRON"
API_URL="https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases"

echo ""
echo "======================================================================"
echo "         U.L.T.R.O.N. UNIVERSAL NEURAL CLIENT INSTALLER               "
echo "======================================================================"
echo " [➔] OS Detected: $(uname -s) ($(uname -m))"
echo " [➔] Fetching available versions from GitHub repository..."
echo ""

# Release version registry (v9.6.8 system)
RELEASES=("v9.6.8")

LATEST_TAG="${RELEASES[0]}"

echo " Available Versions:"
for i in "${!RELEASES[@]}"; do
  TAG="${RELEASES[$i]}"
  if [ $i -eq 0 ]; then
    echo "   [$((i+1))] ${TAG} (LATEST RELEASE - DEFAULT)"
  else
    echo "   [$((i+1))] ${TAG}"
  fi
done

echo ""
read -p " Select version number to install [1-${#RELEASES[@]}] (Default 1): " CHOICE

if [[ -z "$CHOICE" || ! "$CHOICE" =~ ^[0-9]+$ ]]; then
  SELECTED_INDEX=0
else
  SELECTED_INDEX=$((CHOICE-1))
  if [ $SELECTED_INDEX -lt 0 ] || [ $SELECTED_INDEX -ge ${#RELEASES[@]} ]; then
    SELECTED_INDEX=0
  fi
fi

SELECTED_TAG="${RELEASES[$SELECTED_INDEX]}"

echo ""
echo "======================================================================"
echo " [➔] Installing U.L.T.R.O.N. Version: ${SELECTED_TAG}"
echo "======================================================================"

OS_TYPE="$(uname -s)"
if [ "$OS_TYPE" == "Darwin" ]; then
  TARGET_ASSET="ULTRON-Setup.dmg"
  DOWNLOAD_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${SELECTED_TAG}/${TARGET_ASSET}"
  DEST_FILE="/tmp/ULTRON-Setup-${SELECTED_TAG}.dmg"
  
  echo " [↓] Downloading ${TARGET_ASSET}..."
  curl -L "${DOWNLOAD_URL}" -o "${DEST_FILE}"
  echo " [✓] Download complete. Mounting disk image..."
  hdiutil attach "${DEST_FILE}"
  echo " [✓] Disk image mounted. Drag ULTRON to your Applications folder!"
else
  TARGET_ASSET="ULTRON-Setup.AppImage"
  DOWNLOAD_URL="https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${SELECTED_TAG}/${TARGET_ASSET}"
  DEST_FILE="/tmp/ULTRON-Setup-${SELECTED_TAG}.AppImage"
  
  echo " [↓] Downloading ${TARGET_ASSET}..."
  curl -L "${DOWNLOAD_URL}" -o "${DEST_FILE}"
  chmod +x "${DEST_FILE}"
  echo " [⚡] Launching U.L.T.R.O.N. AppImage (${SELECTED_TAG})..."
  "${DEST_FILE}" &
fi

echo ""
echo " [✓] U.L.T.R.O.N. Universal Installer session completed."
echo "======================================================================"
