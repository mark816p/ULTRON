"use client";

export type VoiceProfile = "jarvis" | "friday" | "edith" | "off";

export interface VoiceConfig {
  profile: VoiceProfile;
  useFishStudio: boolean;
  fishApiKey?: string;
  rate: number;
  pitch: number;
}

export class VoiceEngine {
  private profile: VoiceProfile = "jarvis";
  private synth: SpeechSynthesis | null = null;
  private audioCtx: AudioContext | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private useFishStudio: boolean = true;
  private fishApiKey: string = "";

  // Preset Fish Studio voice reference IDs for Jarvis, Edith, and Friday
  private fishVoiceIds = {
    jarvis: "e9f0d1a499d647a4a6fa467ef26f8d38", // Deep British Male holographic tone
    edith: "7e523f03b29d4949a21e64906db49efd",  // Sleek Tactical Female tone
    friday: "b3f07a21643c48dca21589ee18e974e6", // Warm Irish/British Female tone
  };

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
      this.fishApiKey = localStorage.getItem("ultron_fish_api_key") || "";
      const savedFish = localStorage.getItem("ultron_use_fish_studio");
      if (savedFish !== null) {
        this.useFishStudio = savedFish === "true";
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

  public setFishStudioConfig(useFish: boolean, apiKey?: string) {
    this.useFishStudio = useFish;
    if (apiKey !== undefined) this.fishApiKey = apiKey;
    if (typeof window !== "undefined") {
      localStorage.setItem("ultron_use_fish_studio", String(useFish));
      if (apiKey !== undefined) localStorage.setItem("ultron_fish_api_key", apiKey);
    }
  }

  /**
   * Plays sci-fi HUD audio feedback chirp using Web Audio API
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

  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/```[\s\S]*?```/g, " [Code omitted] ")
      .replace(/\[TOOL:\s*.*?\]/g, "")
      .replace(/\[SQZ-REF:.*?\]/g, "")
      .replace(/https?:\/\/\S+/g, "link")
      .replace(/[*#_~`>|-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Synthesizes voice via Fish Studio API or built-in voice synthesizer
   */
  public async speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void,
    overrideProfile?: VoiceProfile
  ) {
    const activeProfile = overrideProfile || this.getProfile();
    if (activeProfile === "off") {
      onEnd?.();
      return;
    }

    this.stop();

    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText) {
      onEnd?.();
      return;
    }

    this.playChirp(600, 0.06, "triangle");

    // 1. Try Fish Studio TTS for Jarvis, Edith, and Friday if enabled
    if (this.useFishStudio && ["jarvis", "edith", "friday"].includes(activeProfile)) {
      try {
        const voiceId = this.fishVoiceIds[activeProfile as "jarvis" | "edith" | "friday"];
        const res = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(this.fishApiKey ? { Authorization: `Bearer ${this.fishApiKey}` } : {}),
          },
          body: JSON.stringify({
            text: cleanText,
            reference_id: voiceId,
            format: "mp3",
            latency: "normal",
          }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);

          audio.onplay = () => onStart?.();
          audio.onended = () => {
            this.playChirp(440, 0.05, "sine");
            onEnd?.();
          };
          audio.onerror = () => this.speakFallback(cleanText, activeProfile, onStart, onEnd);
          await audio.play();
          return;
        }
      } catch (e) {
        console.warn("[VoiceEngine] Fish Studio TTS offline or failed, using built-in fallback:", e);
      }
    }

    // 2. Built-in Speech Synthesis fallback (Zero download required!)
    this.speakFallback(cleanText, activeProfile, onStart, onEnd);
  }

  private speakFallback(
    cleanText: string,
    activeProfile: VoiceProfile,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    if (!this.synth) {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (this.voices.length === 0) this.loadVoices();

    let selectedVoice: SpeechSynthesisVoice | undefined;

    if (activeProfile === "jarvis") {
      selectedVoice =
        this.voices.find(
          (v) =>
            v.name.includes("Google UK English Male") ||
            v.name.includes("George") ||
            v.name.includes("Daniel") ||
            v.name.includes("Arthur")
        ) ||
        this.voices.find(
          (v) => (v.lang === "en-GB" || v.lang === "en-UK") && !v.name.toLowerCase().includes("female")
        ) ||
        this.voices.find((v) => v.lang.startsWith("en-GB") || v.lang.startsWith("en-UK"));
      utterance.pitch = 0.88;
      utterance.rate = 1.05;
    } else if (activeProfile === "friday") {
      selectedVoice =
        this.voices.find((v) => v.lang === "en-IE" || v.name.includes("Irish") || v.name.includes("Moira")) ||
        this.voices.find(
          (v) =>
            v.name.includes("Google UK English Female") ||
            v.name.includes("Hazel") ||
            v.name.includes("Susan")
        ) ||
        this.voices.find(
          (v) => (v.lang === "en-GB" || v.lang === "en-UK") && v.name.toLowerCase().includes("female")
        );
      utterance.pitch = 1.08;
      utterance.rate = 1.12;
    } else if (activeProfile === "edith") {
      selectedVoice =
        this.voices.find(
          (v) =>
            v.name.includes("Google US English") ||
            v.name.includes("Zira") ||
            v.name.includes("Samantha")
        ) ||
        this.voices.find((v) => v.lang === "en-US" && v.name.toLowerCase().includes("female")) ||
        this.voices[0];
      utterance.pitch = 1.15;
      utterance.rate = 0.98;
    }

    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onstart = () => onStart?.();
    utterance.onend = () => {
      this.playChirp(440, 0.05, "sine");
      onEnd?.();
    };
    utterance.onerror = () => onEnd?.();

    this.synth.speak(utterance);
  }

  public stop() {
    if (this.synth && this.synth.speaking) {
      this.synth.cancel();
    }
  }
}

export const voiceEngine = typeof window !== "undefined" ? new VoiceEngine() : null;
