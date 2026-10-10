import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load root .env first, then backend .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

import sessionsRouter from './routes/sessions';
import orchestrateRouter from './routes/orchestrate';
import reportRouter from './routes/report';
import ttsRouter from './routes/tts';
import { isSupabaseConfigured } from './db/supabase';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health and Diagnostics
app.get('/api/health', (_req, res) => {
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    aiProviders: {
      openRouterConfigured: hasOpenRouter,
      openRouterPrimaryModel: process.env.OPENROUTER_PRIMARY_MODEL || 'google/gemini-2.0-flash-001',
      openRouterFallbackModel: process.env.OPENROUTER_FALLBACK_MODEL || 'meta-llama/llama-3.3-70b-instruct',
      geminiDirectFallbackConfigured: hasGemini,
      hasLiveAiKeys: hasOpenRouter || hasGemini
    },
    database: {
      supabaseConfigured: isSupabaseConfigured,
      mode: isSupabaseConfigured ? 'Supabase PostgreSQL' : 'Resilient In-Memory & Local'
    }
  });
});

// API Routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/orchestrate', orchestrateRouter);
app.use('/api/report', reportRouter);
app.use('/api/tts', ttsRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Backend Server Error]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected error occurred'
  });
});

app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 GD Arena Backend Server running on port ${PORT}`);
  console.log(`  AI Engine: OpenRouter Multi-Model Fallback`);
  console.log(`  Supabase: ${isSupabaseConfigured ? 'Connected' : 'Using Local Storage Mode'}`);
  console.log(`======================================================\n`);
});
