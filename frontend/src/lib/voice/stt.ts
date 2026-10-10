/**
 * Web Speech API wrapper with interim caption streaming and silence patience detection
 */

export interface SttCallbacks {
  onInterimResult: (transcript: string) => void;
  onFinalResult: (transcript: string) => void;
  onSilenceTimeout: () => void;
  onError: (error: any) => void;
}

export interface SttConfig {
  patienceMs: number; // 800 - 3000ms
  language?: string; // 'en-IN' | 'en-US'
}

export class SpeechToTextEngine {
  private recognition: any = null;
  private isListening = false;
  private silenceTimer: any = null;
  private currentTranscript = '';
  private config: SttConfig;
  private callbacks: SttCallbacks;
  public isSupported = false;

  constructor(config: SttConfig, callbacks: SttCallbacks) {
    this.config = config;
    this.callbacks = callbacks;

    if (typeof window !== 'undefined') {
      const SpeechRecognition = 
        (window as any).SpeechRecognition || 
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.isSupported = true;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = config.language || 'en-IN';
        this.setupHandlers();
      }
    }
  }

  public updatePatience(patienceMs: number): void {
    this.config.patienceMs = patienceMs;
  }

  private setupHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event: any) => {
      let interim = '';
      let finalStr = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        if (result.isFinal) {
          finalStr += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalStr) {
        this.currentTranscript += ' ' + finalStr;
        this.callbacks.onFinalResult(this.currentTranscript.trim());
      } else if (interim) {
        this.callbacks.onInterimResult((this.currentTranscript + ' ' + interim).trim());
      }

      // Reset patience timer on speech activity
      this.resetSilenceTimer();
    };

    this.recognition.onerror = (event: any) => {
      // Ignore routine abort/no-speech errors
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      console.warn('[STT Engine] Error:', event.error);
      this.callbacks.onError(event.error);
    };

    this.recognition.onend = () => {
      if (this.isListening) {
        // Auto-restart if still marked listening
        try {
          this.recognition.start();
        } catch {}
      }
    };
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    this.silenceTimer = setTimeout(() => {
      if (this.currentTranscript.trim().length > 0) {
        const completed = this.currentTranscript.trim();
        this.currentTranscript = '';
        this.callbacks.onSilenceTimeout();
      }
    }, this.config.patienceMs);
  }

  public start(): void {
    if (!this.recognition || this.isListening) return;
    this.currentTranscript = '';
    this.isListening = true;
    try {
      this.recognition.start();
    } catch (err) {
      console.warn('[STT] Failed to start:', err);
    }
  }

  public stop(): void {
    this.isListening = false;
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
    this.currentTranscript = '';
  }

  public pause(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {}
    }
  }

  public resume(): void {
    if (this.isListening && this.recognition) {
      try {
        this.recognition.start();
      } catch {}
    }
  }
}
