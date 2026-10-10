import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { executeAiCompletion, extractAndParseJson } from '../ai/openrouter';
import { getPersonaById, MODERATOR } from '../lib/personas';
import { Turn, OrchestrationResponse } from '../lib/types';

const router = Router();

const OrchestrateRequestSchema = z.object({
  sessionId: z.string(),
  topic: z.string(),
  topicType: z.string(),
  caseBrief: z.string().optional(),
  languageMode: z.enum(['EN', 'HINGLISH']).default('EN'),
  phase: z.enum(['SETUP', 'INTRO', 'DISCUSSION', 'TIME_WARNING', 'CLOSING', 'REPORT']),
  timeRemainingSec: z.number(),
  rollingTranscript: z.array(z.any()).default([]),
  activePersonas: z.array(z.any()),
  consecutiveAiTurns: z.number().default(0),
  wasStudentInterruption: z.boolean().default(false),
  silentNudgeCount: z.number().default(0)
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const body = OrchestrateRequestSchema.parse(req.body);
    const {
      topic,
      topicType,
      caseBrief,
      languageMode,
      phase,
      timeRemainingSec,
      rollingTranscript,
      activePersonas,
      consecutiveAiTurns,
      wasStudentInterruption,
      silentNudgeCount
    } = body;

    // Check if OpenRouter or Gemini key is configured
    const hasKeys = Boolean(process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY);
    if (!hasKeys) {
      console.warn('[Orchestrate] No AI API keys configured. Using intelligent simulated engine.');
    }

    // 1. PHASE: INTRO
    if (phase === 'INTRO' || rollingTranscript.length === 0) {
      const caseContext = caseBrief ? ` Here is the background brief: "${caseBrief}".` : '';
      const text = `Welcome everyone to this Group Discussion on "${topic}".${caseContext} Before we begin, please note the standard AI disclosure: all fellow participants in this arena, including myself as the moderator, are powered by AI models. The floor is open for healthy, analytical debate. Who would like to start us off?`;
      
      const response: OrchestrationResponse = {
        action: 'MODERATOR_LINE',
        speakerId: 'moderator',
        text,
        reason: 'Session opening with topic announcement and required AI disclosure'
      };
      res.json(response);
      return;
    }

    // 2. PHASE: TIME WARNING (at ~90s left)
    if (phase === 'TIME_WARNING' && timeRemainingSec <= 90 && timeRemainingSec > 20) {
      const response: OrchestrationResponse = {
        action: 'MODERATOR_LINE',
        speakerId: 'moderator',
        text: `Participants, we have approximately 90 seconds remaining in our discussion. Let us start synthesizing our core points and prepare our closing stances.`,
        reason: 'Time warning announcement at T-90s'
      };
      res.json(response);
      return;
    }

    // 3. PHASE: CLOSING
    if (phase === 'CLOSING' || timeRemainingSec <= 0) {
      // Find who hasn't given closing line yet
      const studentSpokeInClosing = rollingTranscript.some(
        (t: Turn) => t.speakerType === 'STUDENT' && t.text.toLowerCase().includes('conclusion')
      );

      if (!studentSpokeInClosing) {
        const response: OrchestrationResponse = {
          action: 'PROMPT_STUDENT',
          speakerId: 'moderator',
          text: `Time is up. We are now in the closing round. Student, please deliver your one-line concluding takeaway.`,
          reason: 'Inviting student to deliver final closing conclusion'
        };
        res.json(response);
        return;
      }

      // Final wrap-up
      const response: OrchestrationResponse = {
        action: 'END',
        speakerId: 'moderator',
        text: `Thank you everyone for a spirited, multi-faceted group discussion. That concludes our session. You may now review your detailed performance analytics.`,
        reason: 'End of group discussion session'
      };
      res.json(response);
      return;
    }

    // 4. HARD RULE: If >= 2 consecutive AI turns have occurred without student, prompt or invite student
    if (consecutiveAiTurns >= 2) {
      const lastTurn = rollingTranscript[rollingTranscript.length - 1];
      const inviter = activePersonas[0]?.name || 'Meera';
      const promptText = languageMode === 'HINGLISH'
        ? `I want to hear from our student participant. Aapka kya stance hai is point pe?`
        : `I'd really like to bring in our student participant here. What is your perspective on this?`;

      const response: OrchestrationResponse = {
        action: 'PROMPT_STUDENT',
        speakerId: activePersonas[0]?.id || 'moderator',
        text: promptText,
        reason: 'Enforcing rule: Max 2 consecutive AI turns without inviting student'
      };
      res.json(response);
      return;
    }

    // 5. Silent Nudge Escalation: If student has been silent for 2+ nudges
    if (silentNudgeCount >= 2) {
      const response: OrchestrationResponse = {
        action: 'PROMPT_STUDENT',
        speakerId: 'moderator',
        text: `Student, we haven't heard your views in a while. Would you like to share your thoughts on the points raised by ${rollingTranscript[rollingTranscript.length - 1]?.speakerName || 'the group'}?`,
        reason: 'Moderator bringing in silent student after consecutive silent nudges'
      };
      res.json(response);
      return;
    }

    // 6. BUILD THE LLM ORCHESTRATION PROMPT
    const personaDescriptions = activePersonas.map((p: any) => 
      `- ${p.name} (${p.role}): ${p.systemPrompt}. Parameters: talkativeness=${p.params?.talkativeness}, interruptLikelihood=${p.params?.interruptLikelihood}`
    ).join('\n');

    const transcriptSummary = rollingTranscript.slice(-10).map((t: any, i: number) => 
      `Turn ${i + 1} [${t.speakerName} (${t.speakerType})]: "${t.text}"`
    ).join('\n');

    const lastSpeaker = rollingTranscript[rollingTranscript.length - 1];

    const systemPrompt = `You are the master GD Orchestrator for "GD Arena".
You manage turn-taking among a live human student and AI participants:
${personaDescriptions}

Topic: "${topic}" (${topicType})${caseBrief ? `\nCase Brief: "${caseBrief}"` : ''}
Language Mode: ${languageMode} (If HINGLISH, naturally code-switch with conversational Hindi expressions like "Bilkul", "Dekho", "Yaar", "Point toh valid hai").

RULES:
1. One speaker per turn.
2. AI participants MUST interact with each other and the student by NAME (e.g. "I agree with Meera, but...", "To Vikram's point...", "What the student said makes sense...").
3. If wasStudentInterruption is true, the chosen speaker MUST acknowledge the interruption smoothly (e.g., "Go ahead, you were saying...", "Please continue your point").
4. Rohan (The Quiet Thinker) speaks rarely and briefly (1-2 lines), redirecting the discussion.
5. Aarav (The Dominator) offers confident, scaling arguments.
6. Meera (The Analyst) asks for data, frameworks, and metrics.
7. Priya (The Tangent Drifter) shares anecdotes and human stories.
8. Vikram (The Devil's Advocate) challenges the consensus or previous speaker.
9. Return strictly JSON matching the required schema.`;

    const userPrompt = `Recent transcript (last ${rollingTranscript.length} turns):
${transcriptSummary || 'Discussion just started.'}

State:
- Last speaker: ${lastSpeaker?.speakerName || 'None'} (${lastSpeaker?.speakerType || 'None'})
- Was student interruption: ${wasStudentInterruption}
- Time remaining: ${Math.round(timeRemainingSec)} seconds
- Consecutive AI turns so far: ${consecutiveAiTurns}

Select the next speaker and generate their realistic spoken line (1-3 sentences).
Choose from active personas: ${activePersonas.map((p: any) => p.id).join(', ')}, or 'moderator'.

Return JSON with this exact schema:
{
  "action": "PARTICIPANT_TURN" | "MODERATOR_LINE" | "PROMPT_STUDENT" | "MOVE_TO_CLOSING",
  "speakerId": "<id of speaker, e.g. aarav, meera, rohan, priya, vikram, or moderator>",
  "text": "<spoken dialogue in 1 to 3 sentences>",
  "reason": "<short rationale for this turn>"
}`;

    if (!hasKeys) {
      // Deterministic fallback response per persona
      const nextPersona = activePersonas[consecutiveAiTurns % activePersonas.length] || activePersonas[0];
      const fallbackLine = nextPersona.fallbackLines[Math.floor(Math.random() * nextPersona.fallbackLines.length)];
      res.json({
        action: 'PARTICIPANT_TURN',
        speakerId: nextPersona.id,
        text: wasStudentInterruption ? `Go ahead, please finish your thought. But my perspective is that ${fallbackLine}` : fallbackLine,
        reason: 'Local fallback engine selection'
      });
      return;
    }

    try {
      const result = await executeAiCompletion({
        systemPrompt,
        userPrompt,
        temperature: 0.8,
        maxTokens: 300,
        jsonMode: true
      });

      const parsed = extractAndParseJson<OrchestrationResponse>(result.content);
      if (!parsed.speakerId || !parsed.text) {
        throw new Error('Incomplete JSON returned from LLM');
      }

      res.json(parsed);
    } catch (llmErr: any) {
      console.warn('[Orchestrator] LLM failed, using resilience fallback:', llmErr.message);
      // Resilience fallback: pick an active persona and use fallback line
      const fallbackPersona = activePersonas[0];
      const randomLine = fallbackPersona.fallbackLines[0];
      res.json({
        action: 'PARTICIPANT_TURN',
        speakerId: fallbackPersona.id,
        text: `Building on what was just said, ${randomLine}`,
        reason: 'Resilience matrix fallback line'
      });
    }
  } catch (err: any) {
    res.status(500).json({ error: 'Orchestration failed', message: err.message });
  }
});

export default router;
