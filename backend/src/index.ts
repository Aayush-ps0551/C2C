import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Force override with real credentials from .env
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
dotenv.config({ override: true });

import sessionsRouter from './routes/sessions';
import orchestrateRouter from './routes/orchestrate';
import listenRouter from './routes/listen';
import speakRouter from './routes/speak';
import reportRouter from './routes/report';
import ttsRouter from './routes/tts';
import { getSupabase } from './db/supabase';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health and Diagnostics
app.get('/api/health', (_req, res) => {
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here');
  const supabaseClient = getSupabase();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    aiProviders: {
      provider: 'OpenRouter (Pure Multi-Model)',
      openRouterConfigured: hasOpenRouter,
      openRouterPrimaryModel: process.env.OPENROUTER_PRIMARY_MODEL || 'nvidia/nemotron-3.5-lightning:free',
      openRouterFallbackModel: process.env.OPENROUTER_FALLBACK_MODEL || 'liquid/lfm-2.5-2.6b:free',
      hasLiveAiKeys: hasOpenRouter
    },
    database: {
      supabaseConfigured: Boolean(supabaseClient),
      mode: supabaseClient ? 'Supabase PostgreSQL' : 'Resilient In-Memory & Local'
    }
  });
});

import pointsRouter from './routes/points';
import loopAnalysisRouter from './routes/loop-analysis';
import noveltyCheckRouter from './routes/novelty-check';
import evaluationsRouter from './routes/evaluations';

// API Routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/orchestrate', orchestrateRouter);
app.use('/api/listen', listenRouter);
app.use('/api/speak', speakRouter);
app.use('/api/report', reportRouter);
app.use('/api/tts', ttsRouter);
app.use('/api/points', pointsRouter);
app.use('/api/loop-analysis', loopAnalysisRouter);
app.use('/api/novelty-check', noveltyCheckRouter);
app.use('/api/evaluations', evaluationsRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Backend Server Error]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

app.listen(PORT, () => {
  const supabaseClient = getSupabase();
  console.log(`\n======================================================`);
  console.log(`  🚀 GD Arena Backend running on port ${PORT}`);
  console.log(`  AI Engine: OpenRouter Multi-Tier Gateway`);
  console.log(`  Primary:   ${process.env.OPENROUTER_PRIMARY_MODEL || 'nvidia/nemotron-3.5-lightning:free'}`);
  console.log(`  Fallback:  ${process.env.OPENROUTER_FALLBACK_MODEL || 'liquid/lfm-2.5-2.6b:free'}`);
  console.log(`  Supabase:  ${supabaseClient ? 'Connected to PostgreSQL' : 'Using Local Storage Mode'}`);
  console.log(`======================================================\n`);
});
