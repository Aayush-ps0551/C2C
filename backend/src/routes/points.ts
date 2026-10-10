import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { executeAiCompletion, extractAndParseJson } from '../ai/openrouter';
import { getGeminiEmbedding } from '../lib/embeddings';

const router = Router();

const PointLedgerSchema = z.object({
  sessionId: z.string(),
  turnIdx: z.number(),
  speakerId: z.string(),
  speakerName: z.string(),
  turnText: z.string(),
  move: z.string(),
  targetId: z.string().optional()
});

router.post('/', async (req: Request, res: Response) => {
  if (!isSupabaseConfigured) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const { sessionId, turnIdx, speakerId, speakerName, turnText, move, targetId } = PointLedgerSchema.parse(req.body);

    // 1. Extract claim via tiny LLM call
    const claimRes = await executeAiCompletion({
      systemPrompt: 'You are an extraction tool. Extract the core claim/point from the following statement in 15 words or less. Return JSON: { "claim": "<extracted>" }.',
      userPrompt: `Statement: "${turnText}"`,
      temperature: 0.2,
      maxTokens: 50,
      jsonMode: true
    }).catch(() => ({ content: JSON.stringify({ claim: turnText.slice(0, 100) }) }));

    const parsed = extractAndParseJson<{ claim: string }>(claimRes.content);
    const claim = parsed.claim || turnText.slice(0, 100);

    // 2. Generate embedding (fail gracefully)
    let embedding: number[] = [];
    try {
      embedding = await getGeminiEmbedding(claim);
    } catch (err: any) {
      console.warn(`[PointLedger] Embedding skipped: ${err.message}`);
    }

    const normText = turnText.toLowerCase().replace(/[^\w\s]/g, '').trim();

    // 3. Check for duplicates in DB for the same speaker (upsert logic via similarity)
    let repeatCount = 1;
    
    // In a real pgvector setup, we'd use RPC. Here we fetch the user's recent points in this session
    // to do exact or near match in node.js if needed. However, since the novelty gate catches it *before* speak, 
    // if we get here, it means it was allowed. We just store it.
    // We'll increment raiseCount if claim text is very similar. For now, simple insert.
    
    const { error: insertErr } = await supabase!.from('PointLedger').insert({
      sessionId,
      turnIdx,
      speakerId,
      speakerName,
      claim,
      normText,
      embedding: embedding.length ? embedding : null,
      move,
      targetId,
      repeatCount,
      addressed: false,
      raiseCount: 1
    });

    if (insertErr) {
      console.error(`[PointLedger] DB Insert Error:`, insertErr.message);
      res.status(500).json({ error: insertErr.message });
      return;
    }

    res.json({ success: true, claim });
  } catch (err: any) {
    console.error(`[PointLedger] Error:`, err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
