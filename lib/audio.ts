// Web Audio API Synthesizer for Buzly Smart Pager
// Zero external mp3 dependencies, works completely offline, synthesized on-the-fly!

class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private loopIntervalId: ReturnType<typeof setInterval> | null = null;
  private isAlarmPlaying: boolean = false;

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
   * to unlock AudioContext on iOS Safari and modern Chromium.
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
      overtone.frequency.setValueAtTime(freq * 2.002, now + delay); // subtle natural detune

      // Envelope: Fast attack, natural exponential release
      const startTime = now + delay;
      gainNode.gain.setValueAtTime(0.0001, startTime);
      gainNode.gain.exponentialRampToValueAtTime(targetGain, startTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      // Connect nodes
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
   * Plays the luxury chime, followed by a double confirmation ping.
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
        // Safe fallback if permission/device doesn't support vibrate
      }
    }
  }

  /**
   * Starts the continuous looping alarm on customer's phone
   * when their buzzer is ringing.
   */
  public startReadyAlarmLoop(): void {
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
        navigator.vibrate(0); // stop vibration
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
    osc1.frequency.setValueAtTime(523.25, now); // C5
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, now + 0.08); // E5

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
