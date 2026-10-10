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
  stereoPan: number; // -0.6..+0.6 screen position mapping
}

export const PERSONA_VOICE_CONFIGS: Record<string, PersonaVoiceConfig> = {
  moderator: {
    pitch: 1.0, rate: 0.95, gender: 'female',
    preferredVoiceNames: ['Google UK English Female', 'Microsoft Zira', 'Samantha', 'Karen', 'Victoria'],
    stereoPan: 0.0
  },
  // SMALL ROOM
  aarav: { // Male Dominator
    pitch: 1.05, rate: 1.15, gender: 'male',
    preferredVoiceNames: ['Google UK English Male', 'Microsoft David', 'Daniel', 'Alex', 'Rishi'], stereoPan: -0.6
  },
  neha: { // Female Analyst
    pitch: 1.0, rate: 1.05, gender: 'female',
    preferredVoiceNames: ['Google US English', 'Microsoft Jenny', 'Fiona', 'Moira', 'Veena'], stereoPan: -0.3
  },
  rohan: { // Male Thinker
    pitch: 0.85, rate: 0.88, gender: 'male',
    preferredVoiceNames: ['Google US English', 'Microsoft Mark', 'Fred', 'Arthur'], stereoPan: 0.1
  },
  
  // MEDIUM ROOM
  kavya: { // Female Drifter
    pitch: 1.2, rate: 1.08, gender: 'female',
    preferredVoiceNames: ['Google US English Female', 'Tessa', 'Princess', 'Kathy'], stereoPan: 0.35
  },
  aditya: { // Male Devil
    pitch: 0.95, rate: 0.98, gender: 'male',
    preferredVoiceNames: ['Google UK English Male', 'Microsoft George', 'Gordon', 'Oliver'], stereoPan: 0.6
  },
  ishan: { // Male Dominator
    pitch: 1.02, rate: 1.12, gender: 'male',
    preferredVoiceNames: ['Google UK English Male', 'Microsoft David', 'Daniel'], stereoPan: -0.4
  },
  priya: { // Female Drifter
    pitch: 1.15, rate: 1.05, gender: 'female',
    preferredVoiceNames: ['Google US English Female', 'Tessa', 'Princess', 'Kathy'], stereoPan: -0.2
  },
  varun: { // Male Thinker
    pitch: 0.88, rate: 0.90, gender: 'male',
    preferredVoiceNames: ['Google US English', 'Microsoft Mark', 'Fred'], stereoPan: 0.4
  },

  // LARGE ROOM
  sanya: { // Female Dominator
    pitch: 1.08, rate: 1.15, gender: 'female',
    preferredVoiceNames: ['Google UK English Female', 'Microsoft Zira', 'Samantha'], stereoPan: -0.6
  },
  kabir: { // Male Devil
    pitch: 0.92, rate: 0.95, gender: 'male',
    preferredVoiceNames: ['Google UK English Male', 'Microsoft George', 'Gordon'], stereoPan: -0.4
  },
  arjun: { // Male Thinker
    pitch: 0.85, rate: 0.88, gender: 'male',
    preferredVoiceNames: ['Google US English', 'Microsoft Mark', 'Fred'], stereoPan: -0.2
  },
  dev: { // Male Dominator
    pitch: 1.05, rate: 1.15, gender: 'male',
    preferredVoiceNames: ['Google UK English Male', 'Microsoft David', 'Daniel'], stereoPan: 0.1
  },
  meera: { // Female Analyst
    pitch: 1.0, rate: 1.05, gender: 'female',
    preferredVoiceNames: ['Google US English', 'Microsoft Jenny', 'Fiona'], stereoPan: 0.3
  },
  ritika: { // Female Drifter
    pitch: 1.2, rate: 1.08, gender: 'female',
    preferredVoiceNames: ['Google US English Female', 'Tessa', 'Princess'], stereoPan: 0.5
  },
  kunal: { // Male Devil
    pitch: 0.95, rate: 0.98, gender: 'male',
    preferredVoiceNames: ['Google UK English Male', 'Microsoft George', 'Oliver'], stereoPan: 0.7
  }
};

/**
 * Play soft chime using Web Audio API for speaker attention, spatialized via StereoPannerNode
 */
export function playSoftChime(speakerId?: string): void {
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

    // R4: Spatial stereo panning
    if (speakerId && ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      const config = PERSONA_VOICE_CONFIGS[speakerId] || PERSONA_VOICE_CONFIGS.moderator;
      pan.pan.setValueAtTime(config.stereoPan ?? 0.0, ctx.currentTime);
      gain.connect(pan);
      pan.connect(ctx.destination);
    } else {
      gain.connect(ctx.destination);
    }

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    // Ignore audio context block
  }
}

/**
 * R4: Emit a sub-second backchannel reaction clip at -18dB under the main audio
 */
export function emitBackchannel(speakerId: string, move: string): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const phraseMap: Record<string, string[]> = {
    AGREE: ['mm-hm', 'exactly'],
    DISAGREE: ['hmm', 'wait—'],
    BUILD: ['right', 'yeah'],
    NEW_ANGLE: ['hmm', 'interesting'],
    ASK_EVIDENCE: ['wait—', 'really?'],
    INTERRUPT: ['wait—'],
    CONCEDE: ['fair enough', 'mm-hm']
  };

  const phrases = phraseMap[move] || ['mm-hm'];
  const text = phrases[Math.floor(Math.random() * phrases.length)];
  const config = PERSONA_VOICE_CONFIGS[speakerId] || PERSONA_VOICE_CONFIGS.moderator;

  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = config.pitch;
    utterance.rate = config.rate * 1.15;
    utterance.volume = 0.125; // -18dB relative to full scale

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      const chosenVoice = voices.find(v => 
        config.preferredVoiceNames.some(name => v.name.toLowerCase().includes(name.toLowerCase()))
      );
      if (chosenVoice) utterance.voice = chosenVoice;
    }

    console.log(`[Backchannel] 🎙️ ${speakerId} reacted softly: "${text}" at -18dB`);
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    // Non-fatal
  }
}

export interface SpeechPlaybackControl {
  cancel: () => void;
  cutAtSentenceBoundary: (onCut: () => void) => void;
}

export function splitSentences(text: string): string[] {
  const matches = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g);
  if (!matches) return [text];
  return matches.map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Speak text using browser SpeechSynthesis with persona voice mapping.
 * Speaks sentence-by-sentence to allow graceful cuts at sentence boundaries on AI interruption.
 */
export function speakWithBrowserTts(
  text: string,
  speakerId: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: any) => void
): SpeechPlaybackControl {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    playSoftChime();
    onStart?.();
    const t = setTimeout(() => onEnd?.(), 1500);
    return {
      cancel: () => clearTimeout(t),
      cutAtSentenceBoundary: (onCut) => { clearTimeout(t); onCut(); }
    };
  }

  // Cancel any prior speech
  window.speechSynthesis.cancel();

  const sentences = splitSentences(text);
  const config = PERSONA_VOICE_CONFIGS[speakerId] || PERSONA_VOICE_CONFIGS.moderator;

  let currentIndex = 0;
  let isCancelled = false;
  let cutCallback: (() => void) | null = null;
  let hasStarted = false;

  function speakNextSentence() {
    if (isCancelled) return;

    if (cutCallback) {
      console.log('[BrowserTTS] ✂️ Reached sentence boundary. Halting speech gracefully.');
      const cb = cutCallback;
      cutCallback = null;
      cb();
      return;
    }

    if (currentIndex >= sentences.length) {
      onEnd?.();
      return;
    }

    const sentence = sentences[currentIndex];
    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.pitch = config.pitch;
    utterance.rate = config.rate;

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      let chosenVoice = voices.find(v => 
        config.preferredVoiceNames.some(name => v.name.toLowerCase().includes(name.toLowerCase()))
      );

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
      if (!hasStarted) {
        hasStarted = true;
        onStart?.();
      }
    };

    utterance.onend = () => {
      currentIndex++;
      speakNextSentence();
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') {
        return;
      }
      currentIndex++;
      speakNextSentence();
    };

    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      currentIndex++;
      speakNextSentence();
    }
  }

  speakNextSentence();

  return {
    cancel: () => {
      isCancelled = true;
      try {
        window.speechSynthesis.cancel();
      } catch {}
    },
    cutAtSentenceBoundary: (onCut: () => void) => {
      cutCallback = onCut;
    }
  };
}
