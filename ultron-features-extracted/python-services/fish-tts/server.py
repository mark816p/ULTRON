"""
Fish Speech bridge for U.L.T.R.O.N.'s three named voice personas
(JARVIS / FRIDAY / EDITH).

Why a separate Python process: fish-speech is a PyTorch project, not a
Node-portable one - unlike everything else in this app (OmniRoute, Whisper
via transformers.js), there's no JS runtime for it. This mirrors the same
"spawn a local process, talk HTTP to it" pattern main.js already uses for
Next.js and OmniRoute.

License note: this uses the fish-speech 1.4-era checkpoint line
(BSD-3-Clause code, CC-BY-NC-SA-4.0 weights) rather than the newer flagship,
which ships under a custom, more restrictive Fish Audio Research License.
CC-BY-NC-SA-4.0 is non-commercial share-alike - appropriate for a personal
project, but re-check the license yourself before any commercial use.

Voice cloning note: JARVIS/FRIDAY/EDITH are Marvel character names/voices.
Point the three reference clips below at YOUR OWN recordings (your voice, a
voice actor you have the rights to use, or a synthesized generic take) -
not audio extracted from the films. Cloning a specific named performer's
voice from copyrighted footage raises its own likeness/rights problems
independent of anything above.

Setup (one-time, run scripts/setup-local-ai.sh - needs a real internet
connection, which this sandbox does not have, so this has NOT been executed
or verified end-to-end):
    1. python -m venv .venv && source .venv/bin/activate
    2. pip install -r requirements.txt
    3. Download the checkpoint into ./checkpoints/ (see requirements.txt
       for the exact source - verify the current download instructions
       against the fish-speech repo, since checkpoint hosting/paths change).
    4. Drop your three reference clips into ./voices/ as jarvis.wav,
       friday.wav, edith.wav (~10-30s of clean speech each).
"""

import io
import json
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8765
BASE_DIR = Path(__file__).parent
CHECKPOINT_DIR = BASE_DIR / "checkpoints"
VOICES_DIR = BASE_DIR / "voices"

VOICE_REFERENCE_CLIPS = {
    "jarvis": VOICES_DIR / "jarvis.wav",
    "friday": VOICES_DIR / "friday.wav",
    "edith": VOICES_DIR / "edith.wav",
}

_engine = None  # lazily-loaded fish-speech inference engine


def _model_ready() -> bool:
    return CHECKPOINT_DIR.exists() and any(CHECKPOINT_DIR.iterdir())


def _load_engine():
    """
    Loads fish-speech once and reuses it for every request. The exact import
    path/class names below follow fish-speech's inference API as documented
    in its repo at the time this was written - if fish-speech has since
    changed its API, this is the one place to update it.
    """
    global _engine
    if _engine is not None:
        return _engine
    if not _model_ready():
        raise RuntimeError(
            f"No checkpoint found in {CHECKPOINT_DIR}. Run scripts/setup-local-ai.sh first."
        )
    from fish_speech.inference_engine import TTSInferenceEngine  # type: ignore

    _engine = TTSInferenceEngine(checkpoint_path=str(CHECKPOINT_DIR))
    return _engine


def synthesize(text: str, voice: str) -> bytes:
    ref_clip = VOICE_REFERENCE_CLIPS.get(voice)
    if not ref_clip or not ref_clip.exists():
        raise RuntimeError(
            f"No reference clip for voice '{voice}' at {ref_clip} - "
            "add your own recording there (see this file's docstring)."
        )
    engine = _load_engine()
    audio_array, sample_rate = engine.synthesize(text=text, reference_audio=str(ref_clip))

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(audio_array.tobytes())
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[fish-tts] {fmt % args}")

    def do_GET(self):
        if self.path == "/health":
            ready = _model_ready()
            body = json.dumps({"status": "ok" if ready else "no_checkpoint", "ready": ready}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != "/synthesize":
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
            text = (payload.get("text") or "").strip()
            voice = (payload.get("voice") or "jarvis").lower()
            if not text:
                raise ValueError("Missing 'text'")
            if voice not in VOICE_REFERENCE_CLIPS:
                raise ValueError(f"Unknown voice '{voice}' - expected jarvis/friday/edith")

            wav_bytes = synthesize(text, voice)
            self.send_response(200)
            self.send_header("Content-Type", "audio/wav")
            self.send_header("Content-Length", str(len(wav_bytes)))
            self.end_headers()
            self.wfile.write(wav_bytes)
        except Exception as exc:  # noqa: BLE001 - want to report any failure to the caller
            body = json.dumps({"error": str(exc)}).encode()
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)


if __name__ == "__main__":
    print(f"[fish-tts] Starting on port {PORT} (checkpoint ready: {_model_ready()})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
