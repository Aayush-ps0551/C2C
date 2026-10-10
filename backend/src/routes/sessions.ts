import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { 
  createSessionDb, 
  getSessionDb, 
  listSessionsDb, 
  updateSessionStatusDb, 
  addTurnDb, 
  getTurnsDb 
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
    panelSize: z.number().default(4)
  }).optional()
});

// POST /api/sessions - Create new session
router.post('/', async (req: Request, res: Response) => {
  try {
    const parsed = CreateSessionSchema.parse(req.body);
    const selectedPersonas = selectRandomPanel(parsed.panelSize);
    const personaIds = selectedPersonas.map(p => p.id);

    const sessionId = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);

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
        panelSize: parsed.panelSize
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
    turnData.sessionId = req.params.id;
    if (!turnData.id) {
      turnData.id = 'turn_' + Math.random().toString(36).substring(2, 9);
    }
    await addTurnDb(turnData);
    res.status(201).json({ turn: turnData });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record turn', message: err.message });
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
