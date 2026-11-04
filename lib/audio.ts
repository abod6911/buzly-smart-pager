// Web Audio API Synthesizer & Multi-Theme Audio Engine for Buzly Smart Pager
// Zero external MP3 dependencies, works offline and in background!

import { ChimeSoundTheme } from '@/types/queue';

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private loopIntervalId: ReturnType<typeof setInterval> | null = null;
  private isAlarmPlaying: boolean = false;
  private silentOscillator: OscillatorNode | null = null;
  private silentGain: GainNode | null = null;
  private isSilentKeepAliveRunning: boolean = false;
  private currentTheme: ChimeSoundTheme = 'hospitality';

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  public setTheme(theme: ChimeSoundTheme) {
    this.currentTheme = theme;
  }

  public async unlock(): Promise<boolean> {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    return ctx.state === 'running';
  }

  public startSilentKeepAlive(): void {
    if (this.isSilentKeepAliveRunning) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(30, ctx.currentTime);
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
    } catch {
      // Ignore
    }
    this.isSilentKeepAliveRunning = false;
  }

  /**
   * Theme 1: Luxury Hospitality Concierge (Airport / Luxury Hotel Chime)
   */
  public playHospitalityChime(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, delay: 0.0, dur: 1.2, gain: 0.3 },   // D5
      { freq: 739.99, delay: 0.18, dur: 1.2, gain: 0.32 },  // F#5
      { freq: 880.0, delay: 0.36, dur: 1.5, gain: 0.35 },   // A5
      { freq: 1174.66, delay: 0.54, dur: 2.2, gain: 0.4 },  // D6
    ];

    notes.forEach(({ freq, delay, dur, gain: targetGain }) => {
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);

      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2.002, now + delay);

      const startTime = now + delay;
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(targetGain, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      osc.connect(gainNode);
      overtone.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime);
      overtone.start(startTime);
      osc.stop(startTime + dur);
      overtone.stop(startTime + dur);
    });
  }

  /**
   * Theme 2: Coffee Zen Vibraphone (Warm, calm, organic cafe chime)
   */
  public playCoffeeZenChime(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 440.0, delay: 0.0, dur: 1.8, gain: 0.28 },  // A4
      { freq: 659.25, delay: 0.2, dur: 2.0, gain: 0.32 }, // E5
      { freq: 880.0, delay: 0.45, dur: 2.5, gain: 0.35 }, // A5
    ];

    notes.forEach(({ freq, delay, dur, gain: targetGain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);

      const startTime = now + delay;
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(targetGain, startTime + 0.04);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  }

  /**
   * Theme 3: Fast-Casual Modern Ding (Crisp, high-energy notification)
   */
  public playFastCasualDing(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 783.99, delay: 0.0, dur: 0.8, gain: 0.35 },  // G5
      { freq: 1046.5, delay: 0.12, dur: 1.4, gain: 0.42 }, // C6
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
      gainNode.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  }

  /**
   * Theme 4: Retro Vibrating Restaurant Buzzer (Classic physical buzzer beep)
   */
  public playRetroBuzzer(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pulses = [0, 0.22, 0.44];

    pulses.forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now + delay);
      osc.frequency.linearRampToValueAtTime(260, now + delay + 0.14);

      const startTime = now + delay;
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  /**
   * Plays the sound according to the selected theme
   */
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

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 150, 400, 150, 800]);
      } catch {}
    }
  }

  /**
   * Arabic Voice Order Callout (Web Speech API)
   * Example: "الطلب رقم مائة وأربعة جاهز للاستلام"
   */
  public announceOrderArabic(orderNumber: string, restaurantName?: string): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel(); // Cancel any lingering utterance

      const speechText = `طلب رقم ${orderNumber} جاهز للاستلام`;
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;

      // Try finding an Arabic voice
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

  public startReadyAlarmLoop(theme: ChimeSoundTheme = this.currentTheme): void {
    this.stopSilentKeepAlive();

    if (this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;

    this.playThemedChime(theme);

    this.loopIntervalId = setInterval(() => {
      if (!this.isAlarmPlaying) return;
      this.playThemedChime(theme);
    }, 3800);
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
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.035);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  public playSuccessTone(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.08);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  }
}

export const soundManager = new AudioSynthesizer();
