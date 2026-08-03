#!/usr/bin/env bash
# One-time setup for the local STT (Whisper) and TTS (Fish Speech) features.
#
# Why this exists as a separate manual step: both features need real model
# weights (tens of MB for Whisper, ~1GB+ for Fish Speech) that have to come
# from their real hosts (Hugging Face Hub, Fish Audio's releases) - this
# repo was prepared in a sandboxed environment with no route to those hosts,
# so this script has NOT been run or verified end-to-end. Run it yourself
# before building the installer; re-check the exact fish-speech commands
# against https://github.com/fishaudio/fish-speech if anything here has
# drifted, since it's a fast-moving project.
#
# Run from the repo root: bash scripts/setup-local-ai.sh

set -e

echo "== 1/3: Whisper (local dictation / speech-to-text) =="
echo "Fetching Xenova/whisper-tiny.en into models/whisper-tiny.en ..."
mkdir -p models
node -e "
const { pipeline, env } = require('@huggingface/transformers');
env.cacheDir = 'models';
(async () => {
  await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', { dtype: 'q8' });
  console.log('Whisper model cached under models/');
})();
"

echo ""
echo "== 2/3: Fish Speech (jarvis/friday/edith voices) =="
FISH_DIR="python-services/fish-tts"
if [ ! -d "$FISH_DIR/.venv" ]; then
  python3 -m venv "$FISH_DIR/.venv"
fi
# shellcheck disable=SC1091
source "$FISH_DIR/.venv/bin/activate"
pip install --upgrade pip
pip install -r "$FISH_DIR/requirements.txt"
# Pin/verify this tag against the repo's current releases before running:
pip install "git+https://github.com/fishaudio/fish-speech.git@v1.4.3"

mkdir -p "$FISH_DIR/checkpoints"
python3 -c "
from huggingface_hub import snapshot_download
# Verify this repo id is still current - fish-speech's checkpoint hosting
# has moved before.
snapshot_download(repo_id='fishaudio/fish-speech-1.4', local_dir='$FISH_DIR/checkpoints')
"
deactivate

echo ""
echo "== 3/3: Voice reference clips =="
mkdir -p "$FISH_DIR/voices"
echo "Now add YOUR OWN reference recordings (10-30s, clean single-speaker audio) as:"
echo "  $FISH_DIR/voices/jarvis.wav"
echo "  $FISH_DIR/voices/friday.wav"
echo "  $FISH_DIR/voices/edith.wav"
echo "Do not use audio extracted from the films - see python-services/fish-tts/server.py"
echo "for why, and use your own voice, a voice actor you have rights to, or a synthetic take instead."
echo ""
echo "Setup complete. 'npm run app' will now start both local services automatically."
