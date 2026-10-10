/**
 * Text-to-Speech Engine with multi-tier fallback:
 * 1. Server TTS (Gemini/Cloud TTS) if available
 * 2. Browser SpeechSynthesis with persona-specific voice/pitch/rate tuning
 * 3. Web Audio API gentle speaker chime + caption fallback
 */

export interface PersonaVoiceConfig {
  pitch: number;
  rate: number;
  gender: 'male' | 'female';
  preferredVoiceNames: string[];
}

export const PERSONA_VOICE_CONFIGS: Record<string, PersonaVoiceConfig> = {
  moderator: {
    pitch: 1.0,
    rate: 0.95,
    gender: 'female',
    preferredVoiceNames: ['Google UK English Female', 'Microsoft Zira', 'Samantha', 'Karen', 'Victoria']
  },
  aarav: {
    pitch: 1.05,
    rate: 1.15,
    gender: 'male',
    preferredVoiceNames: ['Google UK English Male', 'Microsoft David', 'Daniel', 'Alex', 'Rishi']
  },
  meera: {
    pitch: 1.0,
    rate: 1.0,
    gender: 'female',
    preferredVoiceNames: ['Google US English', 'Microsoft Jenny', 'Fiona', 'Moira', 'Veena']
  },
  rohan: {
    pitch: 0.85,
    rate: 0.9,
    gender: 'male',
    preferredVoiceNames: ['Google US English', 'Microsoft Mark', 'Fred', 'Arthur']
  },
  priya: {
    pitch: 1.25,
    rate: 1.05,
    gender: 'female',
    preferredVoiceNames: ['Google US English Female', 'Tessa', 'Princess', 'Kathy']
  },
  vikram: {
    pitch: 0.95,
    rate: 1.1,
    gender: 'male',
    preferredVoiceNames: ['Google UK English Male', 'Microsoft George', 'Gordon', 'Oliver']
  }
};

/**
 * Play soft chime using Web Audio API for speaker attention
 */
export function playSoftChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    // Ignore audio context block
  }
}

/**
 * Speak text using browser SpeechSynthesis with persona voice mapping
 */
export function speakWithBrowserTts(
  text: string,
  speakerId: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): () => void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    playSoftChime();
    onStart?.();
    setTimeout(() => onEnd?.(), 1500);
    return () => {};
  }

  // Cancel any prior speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  const config = PERSONA_VOICE_CONFIGS[speakerId] || PERSONA_VOICE_CONFIGS.moderator;

  utterance.pitch = config.pitch;
  utterance.rate = config.rate;

  // Pick best matching voice
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    let chosenVoice = voices.find(v => 
      config.preferredVoiceNames.some(name => v.name.toLowerCase().includes(name.toLowerCase()))
    );

    // Fallback by gender/accent
    if (!chosenVoice) {
      chosenVoice = voices.find(v => 
        (v.lang.startsWith('en') || v.lang.startsWith('hi')) &&
        (config.gender === 'female' ? v.name.toLowerCase().includes('female') : v.name.toLowerCase().includes('male'))
      );
    }

    if (!chosenVoice) {
      chosenVoice = voices.find(v => v.lang.startsWith('en')) || voices[0];
    }

    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }
  }

  utterance.onstart = () => {
    onStart?.();
  };

  utterance.onend = () => {
    onEnd?.();
  };

  utterance.onerror = (e) => {
    console.warn('[BrowserTTS] Error or interrupted:', e);
    // If canceled/interrupted, don't trigger fatal error
    if (e.error === 'interrupted' || e.error === 'canceled') {
      onEnd?.();
    } else {
      playSoftChime();
      onError?.(e);
      onEnd?.();
    }
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    playSoftChime();
    onStart?.();
    setTimeout(() => onEnd?.(), 1500);
  }

  // Return cancel function
  return () => {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  };
}
