const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'as', 
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must', 'that', 'which', 
  'who', 'whom', 'this', 'these', 'those', 'it', 'its', 'they', 'their', 'them', 'we', 'our', 
  'us', 'you', 'your', 'yours', 'i', 'my', 'mine', 'he', 'his', 'him', 'she', 'her', 'hers'
]);

function normalizeAndExtractContentWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0 && !STOP_WORDS.has(word));
}

export interface GroundingValidationResult {
  isValid: boolean;
  reason?: string;
  overlapScore?: number;
}

export function validateGrounding(generatedText: string, previousLines: string[]): GroundingValidationResult {
  const generatedWords = normalizeAndExtractContentWords(generatedText);
  if (generatedWords.length === 0) return { isValid: true };

  // Anti-parrot rule: No AI line may repeat a previous line nearly unchanged.
  // Threshold: 60% content-word overlap.
  for (let i = 0; i < previousLines.length; i++) {
    const line = previousLines[i];
    const lineWords = normalizeAndExtractContentWords(line);
    if (lineWords.length === 0) continue;

    const lineWordSet = new Set(lineWords);
    let overlapCount = 0;
    for (const word of generatedWords) {
      if (lineWordSet.has(word)) overlapCount++;
    }

    const overlapScore = overlapCount / generatedWords.length;
    if (overlapScore >= 0.6) {
      return { 
        isValid: false, 
        overlapScore,
        reason: `Parrot detected: ${Math.round(overlapScore * 100)}% content-word overlap with a previous turn` 
      };
    }
  }

  return { isValid: true };
}
