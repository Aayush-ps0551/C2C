import { OrchestrationResponse, ReportData } from '../lib/types';

export interface CompletionOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface ModelAttemptResult {
  modelUsed: string;
  provider: string;
  content: string;
}

const PRIMARY_MODEL = process.env.OPENROUTER_PRIMARY_MODEL || 'google/gemini-2.0-flash-001';
const FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'meta-llama/llama-3.3-70b-instruct';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

/**
 * Call OpenRouter API with a specific model
 */
async function callOpenRouter(
  model: string,
  options: CompletionOptions
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not configured');
  }

  const messages = [
    { role: 'system', content: options.systemPrompt },
    { role: 'user', content: options.userPrompt }
  ];

  const payload: Record<string, any> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
  };

  if (options.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gdarena.local',
      'X-Title': 'GD Arena Hackathon'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000) // 12s timeout for snappy voice turn response
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${response.status} (${model}): ${errorBody}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`OpenRouter (${model}) returned empty message`);
  }

  return text;
}

/**
 * Direct Gemini fallback if configured and OpenRouter fails
 */
async function callGeminiFallback(options: CompletionOptions): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [
      {
        parts: [
          { text: `${options.systemPrompt}\n\nTask:\n${options.userPrompt}` }
        ]
      }
    ],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 1024,
      ...(options.jsonMode ? { responseMimeType: "application/json" } : {})
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(12000)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`Gemini HTTP ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned empty message');
  }
  return text;
}

/**
 * Executes a prompt with multi-model fallback:
 * 1. OpenRouter Primary Model (e.g. google/gemini-2.0-flash-001)
 * 2. OpenRouter Fallback Model (e.g. meta-llama/llama-3.3-70b-instruct)
 * 3. Gemini Direct Fallback
 */
export async function executeAiCompletion(
  options: CompletionOptions
): Promise<ModelAttemptResult> {
  // 1. Try Primary OpenRouter model
  try {
    const content = await callOpenRouter(PRIMARY_MODEL, options);
    return { modelUsed: PRIMARY_MODEL, provider: 'OpenRouter-Primary', content };
  } catch (primaryErr: any) {
    console.warn(`[AI Engine] Primary model (${PRIMARY_MODEL}) failed: ${primaryErr.message}. Trying fallback model...`);

    // 2. Try Fallback OpenRouter model
    try {
      const content = await callOpenRouter(FALLBACK_MODEL, options);
      return { modelUsed: FALLBACK_MODEL, provider: 'OpenRouter-Fallback', content };
    } catch (fallbackErr: any) {
      console.warn(`[AI Engine] Fallback model (${FALLBACK_MODEL}) failed: ${fallbackErr.message}. Trying direct Gemini...`);

      // 3. Try Gemini fallback
      try {
        const content = await callGeminiFallback(options);
        return { modelUsed: process.env.GEMINI_MODEL || 'gemini-2.5-flash', provider: 'Gemini-Direct', content };
      } catch (geminiErr: any) {
        console.error(`[AI Engine] All AI models failed! OpenRouter: ${primaryErr.message} / ${fallbackErr.message}. Gemini: ${geminiErr.message}`);
        throw new Error(`All configured AI providers failed. Check your API keys.`);
      }
    }
  }
}

/**
 * Safely parses JSON from an LLM response string, stripping code blocks
 */
export function extractAndParseJson<T>(raw: string): T {
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    // Attempt relaxed regex extraction
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
    throw new Error(`Failed to parse structured JSON: ${raw}`);
  }
}
