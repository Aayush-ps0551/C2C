export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function jaccardSimilarityShingles(text1: string, text2: string, shingleSize: number = 4): number {
  const words1 = text1.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  const words2 = text2.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
  
  if (words1.length < shingleSize || words2.length < shingleSize) {
    // Fallback to word-level overlap if too short
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  const shingles1 = new Set<string>();
  for (let i = 0; i <= words1.length - shingleSize; i++) {
    shingles1.add(words1.slice(i, i + shingleSize).join(' '));
  }
  const shingles2 = new Set<string>();
  for (let i = 0; i <= words2.length - shingleSize; i++) {
    shingles2.add(words2.slice(i, i + shingleSize).join(' '));
  }

  const intersection = new Set([...shingles1].filter(x => shingles2.has(x)));
  const union = new Set([...shingles1, ...shingles2]);
  
  return intersection.size / union.size;
}

export async function getGeminiEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured for embeddings.');
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'models/text-embedding-004',
      content: { parts: [{ text }] }
    }),
    signal: AbortSignal.timeout(3000)
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`Gemini Embedding Error: ${response.status} ${errText}`);
  }

  const data = await response.json();
  const embedding = data?.embedding?.values;
  if (!Array.isArray(embedding)) {
    throw new Error('Invalid embedding format from Gemini API.');
  }

  return embedding;
}
