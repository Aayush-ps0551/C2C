import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { executeAiCompletion, extractAndParseJson } from '../ai/openrouter';
import { supabase, isSupabaseConfigured } from '../db/supabase';
import { getPersonaById } from '../lib/personas';
import { ParticipantIntent, IntentMove } from '../lib/types';

const router = Router();

const ListenRequestSchema = z.object({
  sessionId: z.string(),
  personaId: z.string(),
  context: z.object({
    phase: z.string().default('DEBATE'),
    timeRemainingSec: z.number().default(0),
    lastSpeaker: z.string().default('Unknown'),
    lastTurnText: z.string().default(''),
    studentInterim: z.string().optional().default('None'),
    verbatimWindow: z.string().optional().default(''),
    sessionDigest: z.string().optional().default(''),
    turnsSinceSpoke: z.number().default(1),
    yourLastLine: z.string().optional().default(''),
    stance: z.string().optional().default('Observing the discussion'),
    turnCounts: z.any().optional(),
    // Section 4C R7 Injections
    youWereJustInterrupted: z.boolean().optional().default(false),
    yourCutOffText: z.string().optional().default(''),
    yourUnaddressedPoints: z.string().optional().default(''),
    pressCount: z.number().optional().default(0),
    notableMoments: z.string().optional().default(''),
    intensity: z.string().optional().default('REAL_GD')
  })
});

const VALID_MOVES: IntentMove[] = [
  'AGREE',
  'DISAGREE',
  'BUILD',
  'NEW_ANGLE',
  'ASK_EVIDENCE',
  'ASK_CLARIFY',
  'INTERRUPT',
  'RESUME',
  'CONCEDE',
  'YIELD',
  'NONE'
];

router.post('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { sessionId, personaId, context } = ListenRequestSchema.parse(req.body);
    const persona = getPersonaById(personaId);

    if (!persona) {
      res.status(404).json({ error: `Persona with id ${personaId} not found` });
      return;
    }

    // Section 4F F2: DB Reads into generation
    let pointsAlreadyMade = 'None recorded.';
    let yourSaidPoints = 'None recorded.';
    if (isSupabaseConfigured) {
      try {
        const { data: ledger } = await supabase!
          .from('PointLedger')
          .select('speakerId, speakerName, claim, raiseCount')
          .eq('sessionId', sessionId)
          .order('createdAt', { ascending: false })
          .limit(14);
        
        if (ledger && ledger.length > 0) {
          pointsAlreadyMade = ledger.map(r => `${r.speakerName}: '${r.claim}' (raised ${r.raiseCount}x)`).join('\n');
          const own = ledger.filter(r => r.speakerId === personaId);
          if (own.length > 0) {
            yourSaidPoints = own.map(r => `'${r.claim}'`).join('\n');
          }
        }
      } catch(e) { console.warn('F2 DB Read Error (listen):', e); }
    }

    const talkativeness = (persona.params.talkativeness * 3).toFixed(1);
    const interruptLikelihood = (persona.params.interruptLikelihood * 3).toFixed(1);
    const driftLikelihood = (persona.params.driftLikelihood * 3).toFixed(1);
    const buildOnOthersLikelihood = (persona.params.buildOnOthersLikelihood * 3).toFixed(1);

    const turnCountsStr = typeof context.turnCounts === 'object' && context.turnCounts !== null
      ? Object.entries(context.turnCounts).map(([name, count]) => `${name}: ${count}`).join(', ')
      : String(context.turnCounts || '1 turn each');

    let consequenceNote = '';
    if (context.youWereJustInterrupted) {
      consequenceNote = `\n⚠️ EVENT: You were just interrupted mid-sentence while saying: "${context.yourCutOffText}". As ${persona.name} (stubbornness ${persona.params.stubbornness}, concession ${persona.params.concession}), decide whether to RESUME ("as I was saying"), INTERRUPT (fight back), YIELD ("go ahead"), or CONCEDE.`;
    }
    if (context.yourUnaddressedPoints) {
      consequenceNote += `\n📌 UNADDRESSED POINT: ${context.yourUnaddressedPoints}. If this has gone unaddressed, you may choose to re-raise it firmly.`;
    }
    if (context.pressCount >= 2) {
      consequenceNote += `\n⚡ PRESSURE: You have been pressed with disagreement ${context.pressCount} times. Consider whether to hold ground or offer a partial CONCEDE ("Fair. I'll give you that, but...").`;
    }
    if (context.notableMoments) {
      consequenceNote += `\n🧠 EARLIER NOTABLE MOMENTS: ${context.notableMoments}`;
    }
    if (context.phase === 'CONVERGENCE') {
      consequenceNote += `\n🎯 CONVERGENCE PHASE: Discussion is ending soon. The room must synthesize common ground. Favor AGREE or CONCEDE moves that bridge ideas.`;
    }

    const systemPrompt = `You are ${persona.name} — ${persona.tagline} — silently listening in a LIVE group discussion.
WHO YOU ARE
${persona.systemPrompt}
Tendencies: talkativeness ${talkativeness}/3, interrupt likelihood ${interruptLikelihood}/3, stubbornness ${persona.params.stubbornness}, concession ${persona.params.concession}.
Room Intensity Mode: ${context.intensity}.${consequenceNote}`;

    const userPrompt = `WHAT IS HAPPENING RIGHT NOW
- Phase: ${context.phase}. Time remaining: ${Math.round(context.timeRemainingSec)}s.
- Just now, ${context.lastSpeaker} said: "${context.lastTurnText}"
- If the student is still mid-utterance, their words so far: "${context.studentInterim || 'None'}"
- Recent verbatim transcript: ${context.verbatimWindow || 'Discussion in progress.'}
- Session Digest: ${context.sessionDigest || 'N/A'}

YOUR STATE
- You last spoke ${context.turnsSinceSpoke} turn(s) ago. Your last line: "${context.yourLastLine || 'None'}"
- Your stance so far: ${context.stance || 'Observing'} — revise it based on what you just heard.
- Turn counts so far: ${turnCountsStr}

POINTS ALREADY MADE THIS SESSION (do NOT repeat, restate, or rephrase any of these):
${pointsAlreadyMade}

YOU have already said:
${yourSaidPoints}
-> If you have nothing NEW to add beyond this list, respond move=NONE or CONCEDE instead of repeating yourself.

TASK: As ${persona.name}, return the compact intent JSON. Fill and return this JSON directly without preamble:
{
  "wantsToSpeak": true,
  "urgency": 2,
  "move": "AGREE" | "DISAGREE" | "BUILD" | "NEW_ANGLE" | "ASK_EVIDENCE" | "ASK_CLARIFY" | "INTERRUPT" | "RESUME" | "CONCEDE" | "YIELD" | "NONE",
  "target": "${context.lastSpeaker || 'Student'}",
  "point": "One specific sentence referencing what was just said",
  "draftHook": "Your opening line if given the floor",
  "wouldInterrupt": false,
  "stanceUpdate": "Your revised stance",
  "notable": false
}`;

    const completion = await executeAiCompletion({
      systemPrompt,
      userPrompt,
      temperature: 0.8,
      maxTokens: 600,
      jsonMode: false
    });

    const parsed = extractAndParseJson<ParticipantIntent>(completion.content);
    
    // Sanitize parsed intent
    const sanitizedMove: IntentMove = VALID_MOVES.includes(parsed.move) ? parsed.move : 'BUILD';
    const sanitizedUrgency = ([1, 2, 3].includes(parsed.urgency) ? parsed.urgency : 2) as 1 | 2 | 3;

    const intent: ParticipantIntent = {
      wantsToSpeak: Boolean(parsed.wantsToSpeak),
      urgency: sanitizedUrgency,
      move: sanitizedMove,
      target: parsed.target || 'room',
      point: parsed.point || `Building on ${context.lastSpeaker}'s argument`,
      draftHook: (parsed.draftHook || "I'd like to address that.").slice(0, 100),
      wouldInterrupt: Boolean(parsed.wouldInterrupt),
      stanceUpdate: parsed.stanceUpdate || context.stance || 'Re-evaluating based on the latest arguments.',
      notable: Boolean(parsed.notable),
      timestamp: Date.now()
    };

    console.log(`[Listen Pass] ✅ ${persona.name} listened in ${Date.now() - startTime}ms (wantsToSpeak: ${intent.wantsToSpeak}, move: ${intent.move}, urgency: ${intent.urgency}, notable: ${intent.notable})`);
    res.json(intent);

  } catch (err: any) {
    console.warn(`[Listen Pass Error] Fallback intent generated in ${Date.now() - startTime}ms:`, err.message);
    const persona = getPersonaById(req.body?.personaId);
    
    // Resilient silence fallback
    const fallbackIntent: ParticipantIntent = {
      wantsToSpeak: false,
      urgency: 1,
      move: 'NONE',
      target: req.body?.context?.lastSpeaker || 'room',
      point: 'Observing group direction.',
      draftHook: '',
      wouldInterrupt: false,
      stanceUpdate: req.body?.context?.stance || 'Cautiously evaluating the room.',
      notable: false,
      timestamp: Date.now()
    };

    res.json(fallbackIntent);
  }
});

export default router;
