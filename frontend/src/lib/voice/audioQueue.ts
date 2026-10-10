import { speakWithBrowserTts } from './tts';

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

  /**
   * Barge-in handler: Immediately stops active speech, cancels queue, and marks current turn interrupted
   */
  public stopImmediate(wasInterrupted = false): void {
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
    this.cancelCurrentSpeech = speakWithBrowserTts(
      item.text,
      item.speakerId,
      undefined,
      () => {
        this.cancelCurrentSpeech = null;
        item.onEnd?.();
        // 400-700ms conversational pause
        setTimeout(() => this.playNext(), 500);
      },
      () => {
        this.cancelCurrentSpeech = null;
        item.onEnd?.();
        setTimeout(() => this.playNext(), 500);
      }
    );
  }
}
