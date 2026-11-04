// Web Audio API Synthesizer & iOS Background Keep-Alive for Buzly Smart Pager
// Zero external mp3 dependencies, works offline and in background!

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private loopIntervalId: ReturnType<typeof setInterval> | null = null;
  private isAlarmPlaying: boolean = false;
  private silentOscillator: OscillatorNode | null = null;
  private silentGain: GainNode | null = null;
  private isSilentKeepAliveRunning: boolean = false;

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

  /**
   * Must be called during a user gesture (e.g., button click)
   * to prime and unlock AudioContext on iOS Safari and modern Chromium.
   */
  public async unlock(): Promise<boolean> {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // Play a silent buffer to ensure the context is primed
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);

    return ctx.state === 'running';
  }

  /**
   * iOS Background Keep-Alive:
   * Plays an imperceptible, ultra-low frequency oscillator (30Hz at ~0.0001 gain)
   * which registers an active audio session on iOS Safari and Android.
   * This prevents iOS from freezing the JS runtime when the screen dims or the user
   * switches apps briefly while waiting for their food.
   */
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

      // 30 Hz is below typical phone speaker reproduction threshold
      osc.type = 'sine';
      osc.frequency.setValueAtTime(30, ctx.currentTime);

      // Microscopic gain
      gain.gain.setValueAtTime(0.00005, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();

      this.silentOscillator = osc;
      this.silentGain = gain;
      this.isSilentKeepAliveRunning = true;
    } catch (err) {
      console.warn('Silent keep-alive start error:', err);
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
   * Synthesizes a luxury multi-harmonic airport / hotel concierge chime:
   * Notes: D5 (587.33Hz) -> F#5 (739.99Hz) -> A5 (880Hz) -> D6 (1174.66Hz)
   * Rich sine + triangle harmonics with warm decay.
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

      // Fundamental frequency (Sine for warm bell tone)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);

      // Bell overtone (Soft triangle at 2nd harmonic for crispness)
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2.002, now + delay);

      // Envelope: Fast attack, natural exponential release
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
   * High-contrast Ready Buzzer Alert:
   * Plays the luxury chime, followed by phone vibration.
   */
  public playOrderReadyBurst(): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    this.playHospitalityChime();

    // Subtle vibration on supported mobile devices
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 150, 400, 150, 800]);
      } catch {
        // Safe fallback
      }
    }
  }

  /**
   * Starts the continuous looping alarm on customer's phone
   * when their buzzer is ringing.
   */
  public startReadyAlarmLoop(): void {
    // Stop the silent background audio when switching to the loud alarm
    this.stopSilentKeepAlive();

    if (this.isAlarmPlaying) return;
    this.isAlarmPlaying = true;

    // Trigger immediate ring
    this.playOrderReadyBurst();

    // Repeat every 3.8 seconds until silenced
    this.loopIntervalId = setInterval(() => {
      if (!this.isAlarmPlaying) return;
      this.playOrderReadyBurst();
    }, 3800);
  }

  /**
   * Stops the buzzer alarm loop immediately
   */
  public stopReadyAlarm(): void {
    this.isAlarmPlaying = false;
    if (this.loopIntervalId) {
      clearInterval(this.loopIntervalId);
      this.loopIntervalId = null;
    }

    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {
        // Ignore
      }
    }
  }

  public getIsAlarmPlaying(): boolean {
    return this.isAlarmPlaying;
  }

  /**
   * Tactile click sound for cashier numpad
   */
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

  /**
   * Success notification chime for cashier "Order Added" / "Completed"
   */
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
