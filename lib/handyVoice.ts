"use client";

export interface HandyVoiceOptions {
  wakeWords?: string[];
  onTranscript?: (text: string, isFinal: boolean) => void;
  onWakeWordDetected?: (wakeWord: string) => void;
  onAudioLevel?: (level: number, waveform?: number[]) => void;
  onError?: (error: string) => void;
  autoSubmitDelayMs?: number;
}

export class HandyVoiceEngine {
  private recognition: any = null;
  private isListening: boolean = false;
  private wakeWords: string[] = ["jarvis", "edith", "friday", "ultron", "hey jarvis", "ok jarvis"];
  private silenceTimer: any = null;
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private options: HandyVoiceOptions;

  constructor(options: HandyVoiceOptions = {}) {
    this.options = options;
    if (options.wakeWords) {
      this.wakeWords = options.wakeWords.map((w) => w.toLowerCase());
    }
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("[HandyVoice] Web Speech Recognition API is not supported in this browser.");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const fullText = (finalTranscript || interimTranscript).trim();
      const lower = fullText.toLowerCase();

      for (const word of this.wakeWords) {
        if (lower.includes(word)) {
          this.options.onWakeWordDetected?.(word);
          break;
        }
      }

      this.options.onTranscript?.(fullText, !!finalTranscript);

      if (finalTranscript) {
        clearTimeout(this.silenceTimer);
        this.silenceTimer = setTimeout(() => {
          this.options.onTranscript?.(finalTranscript, true);
        }, this.options.autoSubmitDelayMs || 1200);
      }
    };

    rec.onerror = (event: any) => {
      console.warn("[HandyVoice] Speech recognition error:", event.error);
      this.options.onError?.(event.error);
    };

    rec.onend = () => {
      if (this.isListening) {
        try {
          rec.start();
        } catch (e) {}
      }
    };

    this.recognition = rec;
  }

  public async startListening(): Promise<boolean> {
    if (!this.recognition) return false;
    try {
      this.isListening = true;
      this.recognition.start();
      await this.startAudioMeter();
      return true;
    } catch (e) {
      console.warn("[HandyVoice] Failed to start speech recognition:", e);
      return false;
    }
  }

  public stopListening() {
    this.isListening = false;
    clearTimeout(this.silenceTimer);
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
    this.stopAudioMeter();
  }

  private async startAudioMeter() {
    try {
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!this.analyser || !this.isListening) return;
        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        const waveformArr: number[] = [];
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
          waveformArr.push(buffer[i] / 255);
        }
        const avg = sum / buffer.length;
        const normalized = Math.min(1, avg / 128);
        this.options.onAudioLevel?.(normalized, waveformArr);
        this.animFrameId = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (e) {
      console.warn("[HandyVoice] Audio meter failed:", e);
    }
  }

  private stopAudioMeter() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
  }
}
