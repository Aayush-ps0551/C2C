import { describe, it, expect } from 'vitest';
import { 
  calculateParticipantScore, 
  calculateRankings,
  EvaluationCriterion,
  Participant
} from '../lib/evaluationsEngine';

const criteria: EvaluationCriterion[] = [
  { id: 'c1', name: 'Subject Knowledge', weightage: 25 },
  { id: 'c2', name: 'Communication', weightage: 20 },
  { id: 'c3', name: 'Logical Thinking', weightage: 20 },
  { id: 'c4', name: 'Leadership', weightage: 15 },
  { id: 'c5', name: 'Teamwork', weightage: 10 },
  { id: 'c6', name: 'Confidence', weightage: 10 },
];

describe('Evaluations Engine', () => {
  it('calculates weighted score correctly for a single evaluator', () => {
    const participant: Participant = {
      id: 'p1',
      name: 'Alice',
      evaluations: [
        {
          evaluatorId: 'e1',
          scores: [
            { criterionId: 'c1', score: 8 },
            { criterionId: 'c2', score: 7 },
            { criterionId: 'c3', score: 9 },
            { criterionId: 'c4', score: 8 },
            { criterionId: 'c5', score: 7 },
            { criterionId: 'c6', score: 8 },
          ]
        }
      ]
    };

    const result = calculateParticipantScore(participant, criteria);
    
    // (8/10)*25 + (7/10)*20 + (9/10)*20 + (8/10)*15 + (7/10)*10 + (8/10)*10
    // = 20 + 14 + 18 + 12 + 7 + 8 = 79
    expect(result.finalScore).toBe(79);
    expect(result.performanceLevel).toBe('Good');
  });

  it('calculates average correctly for multiple evaluators', () => {
    const participant: Participant = {
      id: 'p1',
      name: 'Alice',
      evaluations: [
        {
          evaluatorId: 'e1',
          scores: [
            { criterionId: 'c1', score: 8 }, // 20
            { criterionId: 'c2', score: 8 }, // 16
            { criterionId: 'c3', score: 8 }, // 16
            { criterionId: 'c4', score: 8 }, // 12
            { criterionId: 'c5', score: 8 }, // 8
            { criterionId: 'c6', score: 8 }, // 8
          ] // 80 total
        },
        {
          evaluatorId: 'e2',
          scores: [
            { criterionId: 'c1', score: 10 },
            { criterionId: 'c2', score: 10 },
            { criterionId: 'c3', score: 10 },
            { criterionId: 'c4', score: 10 },
            { criterionId: 'c5', score: 10 },
            { criterionId: 'c6', score: 10 },
          ] // 100 total
        }
      ]
    };

    // Averages should all be 9. 
    // Final score = (9/10) * 100 = 90
    const result = calculateParticipantScore(participant, criteria, 2);
    expect(result.finalScore).toBe(90);
    expect(result.performanceLevel).toBe('Excellent');
  });

  it('rejects if invalid weights provided', () => {
    const badCriteria = [...criteria];
    badCriteria[0] = { ...badCriteria[0], weightage: 30 }; // Sum = 105
    
    expect(() => calculateParticipantScore({ id: '1', name: 'Test', evaluations: [] }, badCriteria)).toThrow(/Total criteria weightage must be 100/);
  });

  it('correctly ranks participants and applies tie breakers', () => {
    const p1: Participant = {
      id: 'p1',
      name: 'Alice',
      evaluations: [
        {
          evaluatorId: 'e1',
          scores: [
            { criterionId: 'c1', score: 8 },
            { criterionId: 'c2', score: 8 },
            { criterionId: 'c3', score: 8 },
            { criterionId: 'c4', score: 8 },
            { criterionId: 'c5', score: 8 },
            { criterionId: 'c6', score: 8 },
          ]
        }
      ] // Score: 80
    };

    const p2: Participant = {
      id: 'p2',
      name: 'Bob',
      evaluations: [
        {
          evaluatorId: 'e1',
          scores: [
            { criterionId: 'c1', score: 10 }, // 25
            { criterionId: 'c2', score: 10 }, // 20
            { criterionId: 'c3', score: 0 },  // 0
            { criterionId: 'c4', score: 10 }, // 15
            { criterionId: 'c5', score: 10 }, // 10
            { criterionId: 'c6', score: 10 }, // 10
          ]
        }
      ] // Score: 80
    };

    const p3: Participant = {
      id: 'p3',
      name: 'Charlie',
      evaluations: [
        {
          evaluatorId: 'e1',
          scores: [
            { criterionId: 'c1', score: 10 },
            { criterionId: 'c2', score: 10 },
            { criterionId: 'c3', score: 10 },
            { criterionId: 'c4', score: 10 },
            { criterionId: 'c5', score: 10 },
            { criterionId: 'c6', score: 10 },
          ]
        }
      ] // Score: 100
    };

    // Rankings without tie breaker => Charlie (1), Alice (2), Bob (2)
    const resultsNoTie = calculateRankings([p1, p2, p3], criteria, []);
    expect(resultsNoTie.find(r => r.participantName === 'Charlie')?.rank).toBe(1);
    expect(resultsNoTie.find(r => r.participantName === 'Alice')?.rank).toBe(2);
    expect(resultsNoTie.find(r => r.participantName === 'Bob')?.rank).toBe(2);

    // Rankings WITH tie breaker on 'c3' (Logical Thinking)
    // Alice got 8 on c3, Bob got 0 on c3
    // So Alice should win tiebreaker over Bob
    const resultsTie = calculateRankings([p1, p2, p3], criteria, ['c3']);
    expect(resultsTie.find(r => r.participantName === 'Charlie')?.rank).toBe(1);
    expect(resultsTie.find(r => r.participantName === 'Alice')?.rank).toBe(2);
    expect(resultsTie.find(r => r.participantName === 'Bob')?.rank).toBe(3);
  });
});
