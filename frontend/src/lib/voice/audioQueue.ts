import { speakWithBrowserTts, SpeechPlaybackControl } from './tts';

export interface QueueItem {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  audioBase64?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onInterrupted?: () => void;
}

export class AudioPlaybackQueue {
  private queue: QueueItem[] = [];
  private isPlaying = false;
  private currentItem: QueueItem | null = null;
  private playbackControl: SpeechPlaybackControl | null = null;
  private cancelCurrentSpeech: (() => void) | null = null;
  private audioElement: HTMLAudioElement | null = null;

  public enqueue(item: QueueItem): void {
    this.queue.push(item);
    if (!this.isPlaying) {
      this.playNext();
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getCurrentSpeakerId(): string | null {
    return this.currentItem?.speakerId || null;
  }

  public getCurrentItem(): QueueItem | null {
    return this.currentItem;
  }

  /**
   * Barge-in handler: Immediately stops active speech, cancels queue, and marks current turn interrupted
   */
  public stopImmediate(wasInterrupted = false): void {
    if (this.playbackControl) {
      this.playbackControl.cancel();
      this.playbackControl = null;
    }

    if (this.cancelCurrentSpeech) {
      this.cancelCurrentSpeech();
      this.cancelCurrentSpeech = null;
    }

    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.src = '';
      this.audioElement = null;
    }

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    if (wasInterrupted && this.currentItem) {
      this.currentItem.onInterrupted?.();
    }

    this.queue = [];
    this.isPlaying = false;
    this.currentItem = null;
  }

  /**
   * AI Interruption handler: cuts current speaker's audio at the NEXT SENTENCE BOUNDARY (not mid-word)
   */
  public cutAtNextSentenceBoundary(onCut: () => void): boolean {
    if (!this.isPlaying || !this.currentItem) {
      return false;
    }

    const current = this.currentItem;
    if (this.playbackControl) {
      console.log(`[AudioQueue] ⚡ Interruption scheduled for ${current.speakerName}. Cutting at sentence boundary.`);
      this.playbackControl.cutAtSentenceBoundary(() => {
        current.onInterrupted?.();
        this.isPlaying = false;
        this.currentItem = null;
        this.playbackControl = null;
        onCut();
      });
      return true;
    } else {
      this.stopImmediate(true);
      onCut();
      return true;
    }
  }

  private playNext(): void {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      this.currentItem = null;
      return;
    }

    this.isPlaying = true;
    this.currentItem = this.queue.shift()!;
    const item = this.currentItem;

    item.onStart?.();

    if (item.audioBase64) {
      // Play server-provided audio base64 stream
      try {
        const audio = new Audio(`data:audio/mp3;base64,${item.audioBase64}`);
        this.audioElement = audio;
        
        audio.onended = () => {
          this.audioElement = null;
          item.onEnd?.();
          // 400-700ms natural conversational pause before next action
          setTimeout(() => this.playNext(), 500);
        };

        audio.onerror = () => {
          console.warn('[AudioQueue] Audio element playback failed, falling back to browser TTS');
          this.fallbackToBrowserSpeech(item);
        };

        audio.play().catch(() => {
          this.fallbackToBrowserSpeech(item);
        });
      } catch {
        this.fallbackToBrowserSpeech(item);
      }
    } else {
      this.fallbackToBrowserSpeech(item);
    }
  }

  private fallbackToBrowserSpeech(item: QueueItem): void {
    this.playbackControl = speakWithBrowserTts(
      item.text,
      item.speakerId,
      undefined,
      () => {
        this.playbackControl = null;
        item.onEnd?.();
        // 400-700ms conversational pause
        setTimeout(() => this.playNext(), 500);
      },
      () => {
        this.playbackControl = null;
        item.onEnd?.();
        setTimeout(() => this.playNext(), 500);
      }
    );
  }
}
