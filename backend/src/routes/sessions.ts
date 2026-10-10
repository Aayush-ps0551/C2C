import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { 
  createSessionDb, 
  getSessionDb, 
  listSessionsDb, 
  updateSessionStatusDb, 
  addTurnDb, 
  getTurnsDb,
  ensureUuid
} from '../db';
import { selectRandomPanel, PERSONAS } from '../lib/personas';
import { Session, Turn } from '../lib/types';

const router = Router();

const CreateSessionSchema = z.object({
  topic: z.string().min(3),
  topicType: z.enum(['CONTEMPORARY', 'ABSTRACT', 'CASE', 'CONTROVERSIAL', 'CUSTOM']),
  caseBrief: z.string().optional(),
  languageMode: z.enum(['EN', 'HINGLISH']).default('EN'),
  panelSize: z.number().min(3).max(5).default(4),
  settings: z.object({
    durationMinutes: z.number().default(8),
    patienceMs: z.number().min(800).max(3000).default(1500),
    nudgeSecs: z.number().default(90),
    languageMode: z.enum(['EN', 'HINGLISH']).default('EN'),
    panelSize: z.number().default(4),
    intensity: z.enum(['CAMPUS_MOCK', 'REAL_GD', 'PLACEMENT_BRUTAL']).default('REAL_GD'),
    openingRoundEnabled: z.boolean().default(true)
  }).optional()
});

// POST /api/sessions - Create new session
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = CreateSessionSchema.parse(req.body);
    const selectedPersonas = selectRandomPanel(parsed.panelSize);
    const personaIds = selectedPersonas.map(p => p.id);

    const sessionId = randomUUID();

    const newSession: Session = {
      id: sessionId,
      topic: parsed.topic,
      topicType: parsed.topicType,
      caseBrief: parsed.caseBrief,
      languageMode: parsed.languageMode,
      panelSize: parsed.panelSize,
      personaIds,
      settings: parsed.settings || {
        durationMinutes: 8,
        patienceMs: 1500,
        nudgeSecs: 90,
        languageMode: parsed.languageMode,
        panelSize: parsed.panelSize,
        intensity: 'REAL_GD',
        openingRoundEnabled: true
      },
      status: 'IN_PROGRESS',
      durationSec: 0,
      createdAt: new Date().toISOString()
    };

    const saved = await createSessionDb(newSession);
    res.status(201).json({ session: saved, activePersonas: selectedPersonas });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: err.errors });
    } else {
      res.status(500).json({ error: 'Failed to create session', message: err.message });
    }
  }
});

// GET /api/sessions - List session history
router.get('/', async (_req: Request, res: Response) => {
  try {
    const sessions = await listSessionsDb();
    res.json({ sessions });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch sessions', message: err.message });
  }
});

// GET /api/sessions/:id - Get session details and turns
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const session = await getSessionDb(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    const turns = await getTurnsDb(req.params.id);
    const activePersonas = PERSONAS.filter(p => session.personaIds.includes(p.id));
    res.json({ session, turns, activePersonas });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch session', message: err.message });
  }
});

// POST /api/sessions/:id/turns - Record a turn
router.post('/:id/turns', async (req: Request, res: Response) => {
  try {
    const turnData = req.body as Turn;
    turnData.sessionId = ensureUuid(req.params.id);
    turnData.id = ensureUuid(turnData.id);

    await addTurnDb(turnData);
    res.status(201).json({ turn: turnData });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record turn', message: err.message });
  }
});

// POST /api/sessions/:id/events - Record session event
router.post('/:id/events', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    console.log(`[SessionEvent] 📌 Session ${req.params.id} event logged: ${event.type}`, event.meta);
    res.status(201).json({ success: true, event });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record event', message: err.message });
  }
});

// POST /api/sessions/:id/end - End session
router.post('/:id/end', async (req: Request, res: Response) => {
  try {
    const { durationSec, status } = req.body;
    await updateSessionStatusDb(
      req.params.id, 
      status === 'ABANDONED' ? 'ABANDONED' : 'COMPLETED', 
      Number(durationSec || 0)
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to end session', message: err.message });
  }
});

export default router;
