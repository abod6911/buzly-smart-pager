// High-Decibel Master Restaurant Audio Engine for Buzly Smart Pager
// Routes via DynamicsCompressorNode + GainNode for maximum punch & loudness in noisy dining areas
// Zero external MP3 files needed - 100% synthesized Web Audio API
// Engineered with explicit Node Disconnection onended to prevent memory leaks during 24/7 continuous operation

import { ChimeSoundTheme } from '@/types/queue';

declare global {
  interface Window {
    __buzly_audio_ctx?: AudioContext;
  }
}

class HighDecibelSoundEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private loopIntervalId: ReturnType<typeof setInterval> | null = null;
  private isAlarmPlaying: boolean = false;
  private currentTheme: ChimeSoundTheme = 'hospitality';

  // Silent keep-alive to prevent mobile browsers from suspending audio session
  private silentOscillator: OscillatorNode | null = null;
  private silentGain: GainNode | null = null;
  private isSilentKeepAliveRunning: boolean = false;

  private initAudioChain(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    try {
      // Reuse existing global singleton AudioContext across all invocations & HMR
      if (!this.ctx) {
        if (window.__buzly_audio_ctx && window.__buzly_audio_ctx.state !== 'closed') {
          this.ctx = window.__buzly_audio_ctx;
        } else {
          const AudioCtxClass =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          if (AudioCtxClass) {
            this.ctx = new AudioCtxClass();
            window.__buzly_audio_ctx = this.ctx;
          }
        }
      }

      if (!this.ctx) return null;

      if (!this.compressor || !this.masterGain) {
        // Dynamics Compressor for high-volume broadcast punch without digital distortion
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
        this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
        this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
        this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.compressor.release.setValueAtTime(0.22, this.ctx.currentTime);

        // Master Gain boosted for maximum restaurant/cafe audibility
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(1.15, this.ctx.currentTime);

        // Chain: Node -> Compressor -> MasterGain -> Destination
        this.compressor.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      return this.ctx;
    } catch (err) {
      console.warn('AudioContext init warning (iOS Safari fallback):', err);
      return null;
    }
  }

  public setTheme(theme: ChimeSoundTheme) {
    this.currentTheme = theme;
  }

  public isAudioUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  public getAudioState(): AudioContextState | 'uninitialized' {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }

  /**
   * Instant Audio Pre-Decoding & Hardware Warm-Up
   * Keeps the AudioContext in 'running' state with a zero-gain (0.0001) continuous oscillator
   * so chime sounds fire in 0ms without iOS hardware wake-up lag.
   */
  public warmUp(): boolean {
    const ctx = this.initAudioChain();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    this.startSilentKeepAlive();
    return ctx.state === 'running';
  }

  public async unlock(): Promise<boolean> {
    try {
      const ctx = this.initAudioChain();
      if (!ctx) return false;

      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }

      // Immediately keep hardware pre-warmed with continuous zero-gain node
      this.startSilentKeepAlive();

      // Play a tiny silent buffer to warm up the audio bus
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.onended = () => {
        try {
          source.disconnect();
        } catch {}
      };
      source.start(0);

      return ctx.state === 'running';
    } catch (err) {
      console.warn('Audio unlock warning:', err);
      return false;
    }
  }

  /**
   * Safe Haptic Vibration Guard (Never throws on iOS Safari)
   */
  public triggerHaptic(pattern: number[] = [600, 150, 600, 150, 1000]): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    try {
      if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // iOS Safari silently ignored
    }
  }

  public stopHaptic(): void {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    try {
      if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(0);
      }
    } catch {}
  }

  public startSilentKeepAlive(): void {
    const ctx = this.initAudioChain();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      if (this.isSilentKeepAliveRunning && this.silentOscillator) {
        return;
      }

      // Continuous zero-gain (0.0001) warm-up oscillator node
      // Guarantees zero latency (<0ms) when 'ready' alert fires
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(30, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      this.silentOscillator = osc;
      this.silentGain = gain;
      this.isSilentKeepAliveRunning = true;
    } catch (err) {
      console.warn('Silent keep-alive warning:', err);
    }
  }

  public stopSilentKeepAlive(): void {
    if (!this.isSilentKeepAliveRunning) return;

    try {
      if (this.silentOscillator) {
        this.silentOscillator.stop();
        this.silentOscillator.disconnect();
        this.silentOscillator = null;
      }
      if (this.silentGain) {
        this.silentGain.disconnect();
        this.silentGain = null;
      }
    } catch {}
    this.isSilentKeepAliveRunning = false;
  }

  /**
   * High-Volume Multi-Harmonic Hospitality Chime
   * Fully cleans up nodes on completion to prevent memory accumulation in 24/7 environments
   */
  public playHospitalityChime(): void {
    const ctx = this.initAudioChain();
    if (!ctx || !this.compressor) return;

    const now = ctx.currentTime;
    const chordNotes = [
      { freq: 523.25, delay: 0.0, dur: 1.4, gain: 0.55 },   // C5
      { freq: 659.25, delay: 0.16, dur: 1.4, gain: 0.58 },  // E5
      { freq: 783.99, delay: 0.32, dur: 1.6, gain: 0.62 },  // G5
      { freq: 1046.50, delay: 0.48, dur: 2.4, gain: 0.72 }, // C6 (Crown bell)
    ];

    chordNotes.forEach(({ freq, delay, dur, gain: targetGain }) => {
      const oscTriangle = ctx.createOscillator();
      const oscSine = ctx.createOscillator();
      const oscShimmer = ctx.createOscillator();
      const noteGain = ctx.createGain();

      oscTriangle.type = 'triangle';
      oscTriangle.frequency.setValueAtTime(freq, now + delay);

      oscSine.type = 'sine';
      oscSine.frequency.setValueAtTime(freq, now + delay);

      oscShimmer.type = 'sine';
      oscShimmer.frequency.setValueAtTime(freq * 2.003, now + delay);

      const startTime = now + delay;
      noteGain.gain.setValueAtTime(0.0001, startTime);
      noteGain.gain.exponentialRampToValueAtTime(targetGain, startTime + 0.025);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      oscTriangle.connect(noteGain);
      oscSine.connect(noteGain);
      oscShimmer.connect(noteGain);
      noteGain.connect(this.compressor!);

      // Memory leak guard: sever audio graph upon finish
      let finishedCount = 0;
      const cleanup = () => {
        finishedCount++;
        if (finishedCount >= 3) {
          try {
            oscTriangle.disconnect();
            oscSine.disconnect();
            oscShimmer.disconnect();
            noteGain.disconnect();
          } catch {}
        }
      };

      oscTriangle.onended = cleanup;
      oscSine.onended = cleanup;
      oscShimmer.onended = cleanup;

      oscTriangle.start(startTime);
      oscSine.start(startTime);
      oscShimmer.start(startTime);

      oscTriangle.stop(startTime + dur);
      oscSine.stop(startTime + dur);
      oscShimmer.stop(startTime + dur);
    });
  }

  /**
   * Theme 2: Coffee Zen Vibraphone
   */
  public playCoffeeZenChime(): void {
    const ctx = this.initAudioChain();
    if (!ctx || !this.compressor) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 440.0, delay: 0.0, dur: 1.8, gain: 0.5 },
      { freq: 659.25, delay: 0.2, dur: 2.0, gain: 0.55 },
      { freq: 880.0, delay: 0.45, dur: 2.5, gain: 0.65 },
    ];

    notes.forEach(({ freq, delay, dur, gain: targetGain }) => {
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);

      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 3, now + delay);

      const startTime = now + delay;
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(targetGain, startTime + 0.035);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      osc.connect(gainNode);
      overtone.connect(gainNode);
      gainNode.connect(this.compressor!);

      let cleaned = 0;
      const cleanup = () => {
        cleaned++;
        if (cleaned >= 2) {
          try {
            osc.disconnect();
            overtone.disconnect();
            gainNode.disconnect();
          } catch {}
        }
      };
      osc.onended = cleanup;
      overtone.onended = cleanup;

      osc.start(startTime);
      overtone.start(startTime);
      osc.stop(startTime + dur);
      overtone.stop(startTime + dur);
    });
  }

  /**
   * Theme 3: Fast-Casual Ding
   */
  public playFastCasualDing(): void {
    const ctx = this.initAudioChain();
    if (!ctx || !this.compressor) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 783.99, delay: 0.0, dur: 0.9, gain: 0.6 },
      { freq: 1046.5, delay: 0.12, dur: 1.6, gain: 0.75 },
    ];

    notes.forEach(({ freq, delay, dur, gain: targetGain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);

      const startTime = now + delay;
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(targetGain, startTime + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      osc.connect(gainNode);
      gainNode.connect(this.compressor!);

      osc.onended = () => {
        try {
          osc.disconnect();
          gainNode.disconnect();
        } catch {}
      };

      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  }

  /**
   * Theme 4: Retro Vibrating Restaurant Buzzer
   */
  public playRetroBuzzer(): void {
    const ctx = this.initAudioChain();
    if (!ctx || !this.compressor) return;

    const now = ctx.currentTime;
    const pulses = [0, 0.22, 0.44];

    pulses.forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(340, now + delay);
      osc.frequency.linearRampToValueAtTime(270, now + delay + 0.14);

      const startTime = now + delay;
      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      osc.connect(gain);
      gain.connect(this.compressor!);

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {}
      };

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  public playThemedChime(theme: ChimeSoundTheme = this.currentTheme): void {
    switch (theme) {
      case 'coffee-zen':
        this.playCoffeeZenChime();
        break;
      case 'fast-casual':
        this.playFastCasualDing();
        break;
      case 'buzzer-retro':
        this.playRetroBuzzer();
        break;
      case 'hospitality':
      default:
        this.playHospitalityChime();
        break;
    }

    this.triggerHaptic([600, 150, 600, 150, 1000]);
  }

  /**
   * Starts rhythmic repeating alert loop every 2.5 seconds until dismissed
   * Keeps AudioContext continuously running without zero-gain interruption
   */
  public startReadyAlarmLoop(theme: ChimeSoundTheme = this.currentTheme): void {
    const ctx = this.initAudioChain();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;

    // Fire immediately on first tick in 0ms
    this.playThemedChime(theme);

    // Repeat every 2.5 seconds
    this.loopIntervalId = setInterval(() => {
      if (!this.isAlarmPlaying) return;
      this.playThemedChime(theme);
    }, 2500);
  }

  public stopReadyAlarm(): void {
    this.isAlarmPlaying = false;
    if (this.loopIntervalId) {
      clearInterval(this.loopIntervalId);
      this.loopIntervalId = null;
    }

    this.stopHaptic();
  }

  public getIsAlarmPlaying(): boolean {
    return this.isAlarmPlaying;
  }

  public playKeyClick(): void {
    const ctx = this.initAudioChain();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(850, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.03);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.start(now);
    osc.stop(now + 0.03);
  }

  public playSuccessTone(): void {
    const ctx = this.initAudioChain();
    if (!ctx || !this.compressor) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.28, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.compressor);

    let ended = 0;
    const cleanup = () => {
      ended++;
      if (ended >= 2) {
        try {
          osc1.disconnect();
          osc2.disconnect();
          gain.disconnect();
        } catch {}
      }
    };
    osc1.onended = cleanup;
    osc2.onended = cleanup;

    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  }

  public playErrorTone(): void {
    const ctx = this.initAudioChain();
    if (!ctx || !this.compressor) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(146.83, now + 0.25);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.compressor);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.start(now);
    osc.stop(now + 0.28);
  }

  public announceOrderArabic(orderNumber: string, restaurantName?: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();

      const speechText = `طلب رقم ${orderNumber} جاهز للاستلام`;
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const arabicVoice = voices.find((v) => v.lang.startsWith('ar'));
      if (arabicVoice) {
        utterance.voice = arabicVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis error:', err);
    }
  }
}

export const soundEngine = new HighDecibelSoundEngine();
export const soundManager = soundEngine;
