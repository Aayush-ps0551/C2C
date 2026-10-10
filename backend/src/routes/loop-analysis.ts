import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { executeAiCompletion, extractAndParseJson } from '../ai/openrouter';

const router = Router();

const LoopAnalysisSchema = z.object({
  sessionId: z.string(),
  topic: z.string(),
  verbatimWindow: z.string()
});

router.post('/', async (req: Request, res: Response) => {
  if (!isSupabaseConfigured) {
    res.status(503).json({ error: 'Supabase not configured' });
    return;
  }

  try {
    const { sessionId, topic, verbatimWindow } = LoopAnalysisSchema.parse(req.body);

    const { data: ledger, error } = await supabase!
      .from('PointLedger')
      .select('speakerName, claim, move, raiseCount, addressed')
      .eq('sessionId', sessionId)
      .order('createdAt', { ascending: false })
      .limit(30);

    const summaryStr = ledger?.map(row => 
      `${row.speakerName} [${row.move}]: "${row.claim}" (Raised: ${row.raiseCount}, Addressed: ${row.addressed})`
    ).join('\n') || 'No points recorded yet.';

    const systemPrompt = `You are a group discussion analyzer.
Return strict JSON with the following schema:
{
  "camps": ["group 1 perspective", "group 2 perspective"],
  "keyClaims": ["claim 1", "claim 2"],
  "openQuestions": ["question 1"],
  "unresolvedConflicts": ["conflict 1"],
  "stagnant": boolean,
  "unexplored": ["angle 1", "angle 2"],
  "moveCycles": ["speaker A disagreeing with B"]
}
If the discussion is repeating identical claims, set stagnant: true.`;

    const userPrompt = `Topic: ${topic}
Recent Verbatim:
${verbatimWindow}

Point Ledger:
${summaryStr}

Analyze the loop status and return the JSON.`;

    const result = await executeAiCompletion({
      systemPrompt,
      userPrompt,
      temperature: 0.2,
      maxTokens: 500,
      jsonMode: true
    });

    const parsed = extractAndParseJson(result.content);
    res.json(parsed);

  } catch (err: any) {
    console.error(`[LoopAnalysis] Error:`, err.message);
    res.status(400).json({ error: err.message });
  }
});

export default router;
