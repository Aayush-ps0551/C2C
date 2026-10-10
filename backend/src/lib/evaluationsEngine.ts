export interface EvaluationCriterion {
  id: string;
  name: string;
  weightage: number; // 0 to 100
}

export interface ScoreSubmission {
  criterionId: string;
  score: number; // 0 to 10
}

export interface ParticipantEvaluation {
  evaluatorId: string;
  scores: ScoreSubmission[];
}

export interface Participant {
  id: string;
  name: string;
  evaluations: ParticipantEvaluation[];
}

export interface FinalResult {
  participantId: string;
  participantName: string;
  finalScore: number; // Out of 100
  percentage: number;
  rank: number;
  performanceLevel: 'Excellent' | 'Good' | 'Average' | 'Needs Improvement';
  criterionAverages: Record<string, number>;
}

export function validateCriteria(criteria: EvaluationCriterion[]): void {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weightage, 0);
  if (totalWeight !== 100) {
    throw new Error(`Total criteria weightage must be 100. Current is ${totalWeight}.`);
  }
}

export function calculateParticipantScore(
  participant: Participant,
  criteria: EvaluationCriterion[],
  requiredEvaluations: number = 1
): Omit<FinalResult, 'rank'> {
  validateCriteria(criteria);

  const completedEvaluations = participant.evaluations.filter(
    (e) => e.scores.length === criteria.length
  );

  if (completedEvaluations.length < requiredEvaluations) {
    throw new Error(`Not enough completed evaluations. Found ${completedEvaluations.length}, required ${requiredEvaluations}`);
  }

  // Calculate averages per criterion
  const criterionAverages: Record<string, number> = {};
  for (const criterion of criteria) {
    let sumScore = 0;
    for (const evaluation of completedEvaluations) {
      const scoreSub = evaluation.scores.find((s) => s.criterionId === criterion.id);
      if (!scoreSub || scoreSub.score < 0 || scoreSub.score > 10) {
        throw new Error(`Invalid or missing score for criterion ${criterion.id}`);
      }
      sumScore += scoreSub.score;
    }
    criterionAverages[criterion.id] = sumScore / completedEvaluations.length;
  }

  // Calculate weighted score
  let finalScore = 0;
  for (const criterion of criteria) {
    const avgScore = criterionAverages[criterion.id];
    // Formula: (Criterion Score / 10) * Criterion Weight
    const weighted = (avgScore / 10) * criterion.weightage;
    finalScore += weighted;
  }

  finalScore = Math.round(finalScore * 100) / 100;

  let performanceLevel: FinalResult['performanceLevel'] = 'Needs Improvement';
  if (finalScore >= 80) performanceLevel = 'Excellent';
  else if (finalScore >= 60) performanceLevel = 'Good';
  else if (finalScore >= 40) performanceLevel = 'Average';

  return {
    participantId: participant.id,
    participantName: participant.name,
    finalScore,
    percentage: finalScore, // Since it's out of 100
    performanceLevel,
    criterionAverages,
  };
}

export function calculateRankings(
  participants: Participant[],
  criteria: EvaluationCriterion[],
  tieBreakerCriteriaIds: string[] = [],
  requiredEvaluations: number = 1
): FinalResult[] {
  const results = participants.map((p) => calculateParticipantScore(p, criteria, requiredEvaluations));

  // Sort descending by final score, applying tie breakers if needed
  results.sort((a, b) => {
    if (b.finalScore !== a.finalScore) {
      return b.finalScore - a.finalScore;
    }

    // Tie-breaker
    for (const criterionId of tieBreakerCriteriaIds) {
      const aScore = a.criterionAverages[criterionId] || 0;
      const bScore = b.criterionAverages[criterionId] || 0;
      if (aScore !== bScore) {
        return bScore - aScore; // Descending
      }
    }

    return 0;
  });

  // Assign ranks
  let currentRank = 1;
  const finalResults: FinalResult[] = [];
  
  for (let i = 0; i < results.length; i++) {
    if (i > 0) {
      const prev = results[i - 1];
      const curr = results[i];
      let isTie = prev.finalScore === curr.finalScore;
      
      if (isTie) {
        for (const criterionId of tieBreakerCriteriaIds) {
          if (prev.criterionAverages[criterionId] !== curr.criterionAverages[criterionId]) {
            isTie = false;
            break;
          }
        }
      }

      if (!isTie) {
        currentRank = i + 1;
      }
    }
    
    finalResults.push({
      ...results[i],
      rank: currentRank,
    });
  }

  return finalResults;
}
