import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PERSONA_VOICE_CONFIGS } from '../lib/voiceConfigs';

const router = Router();

const TtsRequestSchema = z.object({
  text: z.string().min(1),
  speakerId: z.string(),
  styleHint: z.string().optional()
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { text, speakerId, styleHint } = TtsRequestSchema.parse(req.body);
    const config = PERSONA_VOICE_CONFIGS[speakerId] || PERSONA_VOICE_CONFIGS.moderator;

    // Return voice configuration for the client voice engine
    res.json({
      success: true,
      text,
      speakerId,
      voiceConfig: config,
      styleHint
    });
  } catch (err: any) {
    res.status(400).json({ error: 'TTS request invalid', message: err.message });
  }
});

export default router;
