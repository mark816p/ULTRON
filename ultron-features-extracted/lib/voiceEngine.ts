"use client";

export type VoiceProfile = "jarvis" | "friday" | "edith" | "off";

export interface VoiceConfig {
  profile: VoiceProfile;
  rate: number;
  pitch: number;
}

export class VoiceEngine {
  private profile: VoiceProfile = "jarvis";
  private synth: SpeechSynthesis | null = null;
  private audioCtx: AudioContext | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private fishAudio: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
    if (typeof window !== "undefined") {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  public setProfile(profile: VoiceProfile) {
    this.profile = profile;
    if (typeof window !== "undefined") {
      localStorage.setItem("ultron_voice_profile", profile);
    }
    if (profile === "off") {
      this.stop();
    }
  }

  public getProfile(): VoiceProfile {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ultron_voice_profile") as VoiceProfile;
      if (saved && ["jarvis", "friday", "edith", "off"].includes(saved)) {
        this.profile = saved;
      }
    }
    return this.profile;
  }

  /**
   * Plays a subtle sci-fi HUD acoustic telemetry chirp using Web Audio API
   */
  private playChirp(freq = 880, duration = 0.08, type: OscillatorType = "sine") {
    if (!this.audioCtx) return;
    try {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.audioCtx.currentTime + duration);
      
      gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  /**
   * Cleans text by removing code blocks, markdown symbols, and tool call instructions
   */
  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, " [Code block omitted for speech] ")
      .replace(/\[TOOL:\s*.*?\]/g, "")
      .replace(/\[SQZ-REF:.*?\]/g, "")
      .replace(/https?:\/\/\S+/g, "link")
      .replace(/[*#_~`>|-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Speaks the text using the selected AI voice persona (J.A.R.V.I.S., F.R.I.D.A.Y., or E.D.I.T.H.)
   */
  public speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    overrideProfile?: VoiceProfile
  ) {
    const activeProfile = overrideProfile || this.getProfile();
    if (activeProfile === "off" || !this.synth) {
      onEnd?.();
      return;
    }

    this.stop();

    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText) {
      onEnd?.();
      return;
    }

    // Play Iron Man HUD activation chirp
    this.playChirp(600, 0.06, "triangle");

    if (activeProfile === "jarvis" || activeProfile === "friday" || activeProfile === "edith") {
      this.speakWithFish(cleanText, activeProfile, onStart, onEnd);
      return;
    }

    this.speakWithWebSpeech(cleanText, activeProfile, onStart, onEnd);
  }

  /**
   * Fish Speech (local, voice-cloned per persona) for jarvis/friday/edith.
   * Falls back to the Web Speech API path below if the Python bridge
   * (python-services/fish-tts) isn't running - e.g. setup-local-ai.sh
   * hasn't been run yet, or a reference clip is missing for this voice.
   */
  private async speakWithFish(
    cleanText: string,
    profile: "jarvis" | "friday" | "edith",
    onStart?: () => void,
    onEnd?: () => void
  ) {
    try {
      const res = await fetch("http://127.0.0.1:8765/synthesize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: cleanText, voice: profile }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`Fish TTS returned ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.fishAudio = audio;
      audio.onplay = () => onStart?.();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        onEnd?.();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        this.speakWithWebSpeech(cleanText, profile, onStart, onEnd);
      };
      await audio.play();
    } catch (_err) {
      // Fish service not set up/reachable this session - fall back silently,
      // the persona still speaks, just with the browser voice instead.
      this.speakWithWebSpeech(cleanText, profile, onStart, onEnd);
    }
  }

  private speakWithWebSpeech(
    cleanText: string,
    activeProfile: VoiceProfile,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (this.voices.length === 0) {
      this.loadVoices();
    }

    // Find closest matching persona voice
    let selectedVoice: SpeechSynthesisVoice | undefined;

    if (activeProfile === "jarvis") {
      // J.A.R.V.I.S.: British Male / Formal English (UK)
      selectedVoice =
        this.voices.find((v) => v.name.includes("Google UK English Male") || v.name.includes("George") || v.name.includes("Daniel") || v.name.includes("Arthur")) ||
        this.voices.find((v) => (v.lang === "en-GB" || v.lang === "en-UK") && !v.name.toLowerCase().includes("female")) ||
        this.voices.find((v) => v.lang.startsWith("en-GB") || v.lang.startsWith("en-UK"));
      utterance.pitch = 0.88; // authoritative, sophisticated tone
      utterance.rate = 1.05;
    } else if (activeProfile === "friday") {
      // F.R.I.D.A.Y.: Irish / British Female (Kerry Condon style)
      selectedVoice =
        this.voices.find((v) => v.lang === "en-IE" || v.name.includes("Irish") || v.name.includes("Moira")) ||
        this.voices.find((v) => v.name.includes("Google UK English Female") || v.name.includes("Hazel") || v.name.includes("Susan") || v.name.includes("Victoria")) ||
        this.voices.find((v) => (v.lang === "en-GB" || v.lang === "en-UK") && v.name.toLowerCase().includes("female"));
      utterance.pitch = 1.08; // natural, brisk, warm tone
      utterance.rate = 1.12;
    } else if (activeProfile === "edith") {
      // E.D.I.T.H.: American Female / Crisp synthetic tactical voice
      selectedVoice =
        this.voices.find((v) => v.name.includes("Google US English") || v.name.includes("Zira") || v.name.includes("Samantha")) ||
        this.voices.find((v) => v.lang === "en-US" && v.name.toLowerCase().includes("female")) ||
        this.voices[0];
      utterance.pitch = 1.15; // precise, tactical, synthetic tone
      utterance.rate = 0.98;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => {
      onStart?.();
    };

    utterance.onend = () => {
      this.playChirp(440, 0.05, "sine"); // Deactivation chirp
      onEnd?.();
    };

    utterance.onerror = (e) => {
      console.warn("[VoiceEngine] Speech synthesis error:", e);
      onEnd?.();
    };

    this.synth?.speak(utterance);
  }

  public stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
    if (this.fishAudio) {
      this.fishAudio.pause();
      this.fishAudio = null;
    }
  }
}

export const voiceEngine = typeof window !== "undefined" ? new VoiceEngine() : null;
