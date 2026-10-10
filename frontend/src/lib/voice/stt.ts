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
  public isListening = false;
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
      } else {
        console.warn('[STT] Browser does not support Web Speech API');
      }
    }
  }

  public updatePatience(patienceMs: number): void {
    this.config.patienceMs = patienceMs;
  }

  private setupHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      console.log('[STT Engine] 🎙️ Speech recognition started and active');
    };

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
        this.currentTranscript = (this.currentTranscript + ' ' + finalStr).trim();
        console.log('[STT Final]', this.currentTranscript);
        this.callbacks.onFinalResult(this.currentTranscript);
      } else if (interim) {
        const fullInterim = (this.currentTranscript + ' ' + interim).trim();
        this.callbacks.onInterimResult(fullInterim);
      }

      // Reset patience timer on active speech
      this.resetSilenceTimer();
    };

    this.recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      console.warn('[STT Engine] Error:', event.error);
      this.callbacks.onError(event.error);
    };

    this.recognition.onend = () => {
      console.log('[STT Engine] Recognition ended. isListening =', this.isListening);
      if (this.isListening) {
        // Automatically restart continuous listening
        try {
          this.recognition.start();
        } catch (e) {
          // Restart after short delay if busy
          setTimeout(() => {
            if (this.isListening) {
              try { this.recognition.start(); } catch {}
            }
          }, 200);
        }
      }
    };
  }

  private resetSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }

    this.silenceTimer = setTimeout(() => {
      if (this.currentTranscript.trim().length > 0) {
        console.log('[STT] Silence threshold reached. Submitting turn:', this.currentTranscript.trim());
        const completed = this.currentTranscript.trim();
        this.currentTranscript = '';
        this.callbacks.onSilenceTimeout();
      }
    }, this.config.patienceMs);
  }

  public start(): void {
    if (!this.recognition) return;
    this.currentTranscript = '';
    this.isListening = true;
    try {
      this.recognition.start();
      console.log('[STT] Starting speech recognition...');
    } catch (err) {
      console.warn('[STT] Start call caught:', err);
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
    console.log('[STT] Stopped listening');
  }

  public pause(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
    }
    console.log('[STT] Paused listening during AI speech');
  }

  public resume(): void {
    if (!this.recognition) return;
    this.isListening = true;
    this.currentTranscript = '';
    try {
      this.recognition.start();
      console.log('[STT] Resumed listening for student input');
    } catch (e) {
      // If already started or aborting, retry shortly
      setTimeout(() => {
        if (this.isListening) {
          try { this.recognition.start(); } catch {}
        }
      }, 150);
    }
  }
}
