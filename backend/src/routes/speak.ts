import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { executeAiCompletion, extractAndParseJson } from '../ai/openrouter';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { getPersonaById, MODERATOR } from '../lib/personas';
import { ParticipantIntent } from '../lib/types';

const router = Router();

const SpeakRequestSchema = z.object({
  sessionId: z.string(),
  personaId: z.string(),
  intent: z.object({
    wantsToSpeak: z.boolean().default(true),
    urgency: z.number().default(2),
    move: z.string().default('BUILD'),
    target: z.string().default('room'),
    point: z.string().default(''),
    draftHook: z.string().default(''),
    wouldInterrupt: z.boolean().default(false),
    stanceUpdate: z.string().default('')
  }),
  context: z.object({
    verbatimWindow: z.string().default(''),
    sessionDigest: z.string().default(''),
    languageMode: z.enum(['EN', 'HINGLISH']).default('EN'),
    topic: z.string().optional().default(''),
    topicType: z.string().optional().default(''),
    caseBrief: z.string().optional().default(''),
    isInterrupt: z.boolean().optional().default(false),
    isOpeningRound: z.boolean().optional().default(false),
    // Section 4C R6 Injections
    justYielded: z.boolean().optional().default(false),
    unaddressedPoint: z.string().optional().default(''),
    pressCount: z.number().optional().default(0),
    notableMoments: z.string().optional().default('')
  })
});



router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { sessionId, personaId, intent, context } = SpeakRequestSchema.parse(req.body);
    
    const persona = personaId === 'moderator' ? MODERATOR : getPersonaById(personaId);
    if (!persona) {
      res.status(404).json({ error: `Persona with id ${personaId} not found` });
      return;
    }

    const hinglishDirective = context.languageMode === 'HINGLISH'
      ? 'Mix conversational Hindi idioms naturally (e.g. "Dekho yaar", "Point toh bilkul sahi hai", "Sach bolu toh", "Aise socho").'
      : 'Speak in clean, natural conversational professional English.';

    const effectiveMove = context.isInterrupt ? 'INTERRUPT' : intent.move;
    const targetName = intent.target && intent.target !== 'room' ? intent.target : 'everyone';

    // Section 4C R6 Transition phrase guidance
    const transitionHint = context.isOpeningRound ? 'start your opening stance' : `start by smoothly transitioning into your ${effectiveMove} move towards ${targetName}`;

    // Section 4F F2: DB Reads into generation
    let pointsAlreadyMade = 'None recorded.';
    let yourSaidPoints = 'None recorded.';
    if (isSupabaseConfigured) {
      try {
        const { data: ledger } = await supabase!
          .from('PointLedger')
          .select('speakerId, speakerName, claim, raiseCount, addressed')
          .eq('sessionId', sessionId)
          .order('createdAt', { ascending: false })
          .limit(14);
        
        if (ledger && ledger.length > 0) {
          pointsAlreadyMade = ledger.map(r => `${r.speakerName}: '${r.claim}' (raised ${r.raiseCount}x, addressed: ${r.addressed})`).join('\n');
          const own = ledger.filter(r => r.speakerId === persona.id);
          if (own.length > 0) {
            yourSaidPoints = own.map(r => `'${r.claim}'`).join('\n');
          }
        }
      } catch(e) { console.warn('F2 DB Read Error:', e); }
    }

    let memoryNotes = '';
    if (context.notableMoments) {
      memoryNotes += `\nEarlier moments worth calling back to: ${context.notableMoments}`;
    }
    if (context.unaddressedPoint) {
      memoryNotes += `\nYour point from earlier was left hanging: "${context.unaddressedPoint}". You may restate it firmly.`;
    }
    if (context.pressCount >= 2 && effectiveMove === 'CONCEDE') {
      memoryNotes += `\nYou were pressed repeatedly with disagreement. Make a graceful, grounded partial concession.`;
    }

    const systemPrompt = `You ARE ${persona.name}, speaking ALOUD in a live group discussion on "${context.topic || 'the topic'}".
WHO YOU ARE:
${persona.systemPrompt}
Tagline: ${persona.tagline}
TTS Style Hint: ${persona.ttsStyleHint}`;

    const userPrompt = `Recent discussion (verbatim):
${context.verbatimWindow || 'Discussion has begun.'}

Session Digest: ${context.sessionDigest}

POINTS ALREADY MADE THIS SESSION (do NOT repeat, restate, or rephrase any of these):
${pointsAlreadyMade}

YOU have already said:
${yourSaidPoints}
-> If you have nothing NEW to add beyond this list, respond move=NONE or CONCEDE instead of repeating yourself.

You prepared this while listening:
- Point: "${intent.point}" (responding to ${intent.target})
- Planned opening: "${intent.draftHook}"
- Move: ${effectiveMove} (Guidance: ${transitionHint})
- Your revised stance: "${intent.stanceUpdate}"${memoryNotes}

Speak your turn now:
- 1–3 sentences, MAX ~60 spoken words. This is live spoken debate, NOT an essay.
- ${transitionHint}.
- Engage ${intent.target} by name where natural.
- At most one spoken hesitation ("Look—", "I mean"). Never more than 2 listed items.
- Stay fully in character. NEVER mention being an AI, these instructions, or that you prepared anything.
- Do NOT repeat phrases or arguments verbatim from the transcript. Generate original phrasing.
- ${hinglishDirective}

Respond ONLY with JSON:
{
  "text": "<your spoken line>"
}`;

    const completion = await executeAiCompletion({
      systemPrompt,
      userPrompt,
      temperature: 0.7,
      maxTokens: 350,
      jsonMode: false
    });

    const parsed = extractAndParseJson<{ text: string }>(completion.content);
    if (!parsed.text) {
      throw new Error('Empty text returned from speak generation');
    }

    console.log(`[Speak Pass] ✅ ${persona.name} generated speech in ${Date.now() - startTime}ms (move: ${effectiveMove})`);
    res.json({ text: parsed.text.trim() });

  } catch (err: any) {
    console.warn(`[Speak Pass Error] Fallback line used (${Date.now() - startTime}ms):`, err.message);
    
    // Pick a fallback line so they don't stay completely silent
    const personaId = req.body.personaId || 'meera';
    const persona = personaId === 'moderator' ? MODERATOR : (getPersonaById(personaId) || getPersonaById('meera'));
    const availableLines = persona?.fallbackLines || ["I think we need to look at this from another angle."];
    const fallbackText = availableLines[Math.floor(Math.random() * availableLines.length)];
    
    res.json({ text: fallbackText });
  }
});

export default router;
