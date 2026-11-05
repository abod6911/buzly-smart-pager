// High-Decibel Master Restaurant Audio Engine for Buzly Smart Pager
// Routes via DynamicsCompressorNode + GainNode for maximum punch & loudness in noisy dining areas
// Zero external MP3 files needed - 100% synthesized Web Audio API

import { ChimeSoundTheme } from '@/types/queue';

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

    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
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

  public async unlock(): Promise<boolean> {
    const ctx = this.initAudioChain();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Play a tiny silent buffer to warm up the audio bus
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    return ctx.state === 'running';
  }

  public startSilentKeepAlive(): void {
    if (this.isSilentKeepAliveRunning) return;

    const ctx = this.initAudioChain();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(25, ctx.currentTime);
      gain.gain.setValueAtTime(0.00005, ctx.currentTime);

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
   * Synthesizes C5 -> E5 -> G5 -> C6 chord layered with triangle & sine oscillators
   * routed through the dynamics compressor for maximum clarity and punch
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
      // 1. Fundamental warmth & presence (triangle)
      const oscTriangle = ctx.createOscillator();
      // 2. High-frequency chime brilliance (sine)
      const oscSine = ctx.createOscillator();
      // 3. Subtle harmonic shimmer
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
      // Fast attack for crisp mallet strike
      noteGain.gain.exponentialRampToValueAtTime(targetGain, startTime + 0.025);
      // Long, lush harmonic decay
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      oscTriangle.connect(noteGain);
      oscSine.connect(noteGain);
      oscShimmer.connect(noteGain);

      // Route through dynamics compressor
      noteGain.connect(this.compressor!);

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

    // Android & supported device intense vibration pattern
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([600, 150, 600, 150, 1000]);
      } catch {}
    }
  }

  /**
   * Starts rhythmic repeating alert loop every 2.5 seconds until dismissed
   */
  public startReadyAlarmLoop(theme: ChimeSoundTheme = this.currentTheme): void {
    this.stopSilentKeepAlive();

    if (this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;

    // Fire immediately on first tick
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

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
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

    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
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
