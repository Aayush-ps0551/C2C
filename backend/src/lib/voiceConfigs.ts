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
