'use client';

/**
 * High-audibility Web Audio API Pager Synthesizer & Android Haptics
 * Zero external MP3 dependencies; uses DynamicsCompressorNode for safe max loudness.
 */
class WaitlistBuzzerEngine {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private isLooping = false;

  private ensureChain(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx || this.ctx.state === 'closed') {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }

    if (!this.compressor || !this.masterGain) {
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(14, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.18, this.ctx.currentTime);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.4, this.ctx.currentTime);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
    }

    return this.ctx;
  }

  public isUnlocked(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  /**
   * Must be called inside a user gesture ("Join the line" or "Test chime").
   */
  public async unlock(): Promise<boolean> {
    try {
      const ctx = this.ensureChain();
      if (!ctx) return false;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      // Tiny silent buffer to unlock iOS Safari audio bus
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      return ctx.state === 'running';
    } catch {
      return false;
    }
  }

  /**
   * Multi-pulse restaurant pager chime (distinct 3-note rising triad + harmonic).
   */
  public playPagerBurst(): void {
    const ctx = this.ensureChain();
    if (!ctx || !this.compressor) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Crisp, unmistakable restaurant buzzer triad: E5 -> G#5 -> B5 -> E6
    const notes = [
      { freq: 659.25, delay: 0.0, dur: 0.14 },
      { freq: 830.61, delay: 0.14, dur: 0.14 },
      { freq: 987.77, delay: 0.28, dur: 0.14 },
      { freq: 1318.51, delay: 0.42, dur: 0.34 },
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const harmonic = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      harmonic.type = 'sine';
      harmonic.frequency.setValueAtTime(n.freq * 2, now + n.delay);

      const start = now + n.delay;
      const end = start + n.dur;

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.75, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, end);

      osc.connect(gain);
      harmonic.connect(gain);
      gain.connect(this.compressor);

      osc.start(start);
      harmonic.start(start);
      osc.stop(end + 0.02);
      harmonic.stop(end + 0.02);

      osc.onended = () => {
        osc.disconnect();
        harmonic.disconnect();
        gain.disconnect();
      };
    }

    this.triggerVibration();
  }

  public triggerVibration(): void {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate([300, 120, 300, 120, 500]);
      } catch {
        // Ignore on unsupported browsers
      }
    }
  }

  public startPagerLoop(): void {
    if (this.isLooping) return;
    this.isLooping = true;
    this.playPagerBurst();
    this.loopTimer = setInterval(() => {
      if (this.isLooping) {
        this.playPagerBurst();
      }
    }, 3200);
  }

  public stopPagerLoop(): void {
    this.isLooping = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
  }
}

export const waitlistBuzzer = new WaitlistBuzzerEngine();
