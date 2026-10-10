import { Turn } from '../types';

export interface CycleShakeUp {
  isLooping: boolean;
  claims: string[];
  speakers: string[];
}

export function detectCycles(transcript: Turn[]): CycleShakeUp {
  if (transcript.length < 4) return { isLooping: false, claims: [], speakers: [] };

  const recent = transcript.slice(-12);
  const triples = recent.map(t => ({ speakerId: t.speakerId || t.speakerName, move: t.move, targetId: 'room' })); // simplified target

  // A cycle of length N means sequence[i] == sequence[i+N] and sequence[i+1] == sequence[i+N+1], etc.
  for (let n = 2; n <= 4; n++) {
    if (triples.length >= n * 2) {
      let isCycle = true;
      const lastSegment = triples.slice(-n);
      const prevSegment = triples.slice(-(n * 2), -n);

      for (let i = 0; i < n; i++) {
        if (lastSegment[i].speakerId !== prevSegment[i].speakerId || 
            lastSegment[i].move !== prevSegment[i].move) {
          isCycle = false;
          break;
        }
      }

      if (isCycle) {
        // Collect claims
        const loopedTurns = recent.slice(-n);
        return {
          isLooping: true,
          claims: loopedTurns.map(t => t.text.slice(0, 50)),
          speakers: Array.from(new Set(loopedTurns.map(t => t.speakerName)))
        };
      }
    }
  }

  return { isLooping: false, claims: [], speakers: [] };
}
