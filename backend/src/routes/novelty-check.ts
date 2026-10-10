import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { getGeminiEmbedding, cosineSimilarity, jaccardSimilarityShingles } from '../lib/embeddings';

const router = Router();

const NoveltyCheckSchema = z.object({
  sessionId: z.string(),
  speakerId: z.string(),
  text: z.string()
});

router.post('/', async (req: Request, res: Response) => {
  if (!isSupabaseConfigured) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const { sessionId, speakerId, text } = NoveltyCheckSchema.parse(req.body);

    const { data: ledger, error } = await supabase!
      .from('PointLedger')
      .select('speakerId, claim, normText, embedding, turnIdx')
      .eq('sessionId', sessionId);

    if (error) throw new Error(error.message);

    // 1. Verbatim check (Jaccard)
    for (const row of ledger || []) {
      const jaccard = jaccardSimilarityShingles(text, row.normText);
      if (jaccard >= 0.55) {
        res.json({ isRepeat: true, type: 'VERBATIM', evidence: `You already said this (overlap). Do not repeat it. Add NEW information.` });
        return;
      }
    }

    // 2. Paraphrase check (Cosine)
    let embedding: number[] = [];
    try {
      embedding = await getGeminiEmbedding(text);
    } catch (err: any) {
      console.warn(`[NoveltyCheck] Embedding failed:`, err.message);
      // Fallback to client-side logic is handled by throwing or just returning valid if we can't embed
      throw err;
    }

    if (embedding.length > 0) {
      let isFlagged = false;
      for (const row of ledger || []) {
        if (!row.embedding) continue;
        const sim = cosineSimilarity(embedding, row.embedding);
        const isSameSpeaker = row.speakerId === speakerId;
        if ((isSameSpeaker && sim >= 0.86) || (!isSameSpeaker && sim >= 0.92)) {
          res.json({ 
            isRepeat: true, 
            type: 'PARAPHRASE', 
            evidence: `You already said this at turn ${row.turnIdx}: '${row.claim}'. Do not repeat it. Add NEW information, respond to an unaddressed point, or concede.` 
          });
          return;
        } else if (isSameSpeaker && sim >= 0.75 && sim < 0.86) {
          isFlagged = true;
        }
      }
      res.json({ isRepeat: false, isFlagged });
      return;
    }

    res.json({ isRepeat: false, isFlagged: false });

  } catch (err: any) {
    console.error(`[NoveltyCheck] Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
