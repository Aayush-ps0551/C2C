/**
 * High-energy barge-in detector using Web Audio API AnalyserNode.
 * Operates during AI playback to detect student speech interruptions
 * while preventing the app from transcribing its own TTS output.
 */

export interface BargeInDetectorOptions {
  energyThreshold?: number; // RMS threshold (default 0.12)
  sustainedMs?: number; // ms above threshold required to trigger (default 300ms)
  onBargeIn: () => void;
}

export class BargeInDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;
  private highEnergyStartTime: number | null = null;
  private isListening = false;
  private options: Required<BargeInDetectorOptions>;

  constructor(options: BargeInDetectorOptions) {
    this.options = {
      energyThreshold: options.energyThreshold ?? 0.10,
      sustainedMs: options.sustainedMs ?? 300,
      onBargeIn: options.onBargeIn,
    };
  }

  public start(stream: MediaStream): void {
    if (this.isListening) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.4;

      this.source = this.audioContext.createMediaStreamSource(stream);
      this.source.connect(this.analyser);

      this.isListening = true;
      this.highEnergyStartTime = null;
      this.detectLoop();
    } catch (err) {
      console.warn('[BargeInDetector] Failed to initialize:', err);
    }
  }

  public stop(): void {
    this.isListening = false;
    this.highEnergyStartTime = null;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }

  private detectLoop = (): void => {
    if (!this.isListening || !this.analyser) return;

    const buffer = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(buffer);

    // Calculate Root Mean Square (RMS) energy
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    const rms = Math.sqrt(sumSquares / buffer.length);

    const now = performance.now();
    if (rms > this.options.energyThreshold) {
      if (this.highEnergyStartTime === null) {
        this.highEnergyStartTime = now;
      } else if (now - this.highEnergyStartTime >= this.options.sustainedMs) {
        // Sustained high energy detected! Trigger barge-in
        this.highEnergyStartTime = null;
        this.options.onBargeIn();
        return; // Callback will handle state transition
      }
    } else {
      this.highEnergyStartTime = null;
    }

    this.animFrameId = requestAnimationFrame(this.detectLoop);
  };
}
