import { OrchestrationResponse, ReportData } from '../lib/types';
import dotenv from 'dotenv';
import path from 'path';

// Force override with real credentials from .env
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
dotenv.config({ override: true });

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

function getAiConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY || '';
  const primaryModel = process.env.OPENROUTER_PRIMARY_MODEL || 'liquid/lfm-2.5-2.6b:free';
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL || 'nvidia/nemotron-3.5-lightning:free';

  return { apiKey, primaryModel, fallbackModel };
}

/**
 * Call OpenRouter API with a specific model
 */
async function callOpenRouter(
  model: string,
  options: CompletionOptions
): Promise<string> {
  const { apiKey } = getAiConfig();
  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
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

  const startTime = Date.now();
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://gdarena.local',
      'X-Title': 'GD Arena Hackathon'
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(14000)
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`OpenRouter HTTP ${response.status} (${model}): ${errorBody}`);
  }

  const data = await response.json();
  const msg = data?.choices?.[0]?.message;
  const text = msg?.content || msg?.reasoning;
  if (!text) {
    throw new Error(`OpenRouter (${model}) returned empty message`);
  }

  const elapsedMs = Date.now() - startTime;
  console.log(`[AI Engine] ✅ OpenRouter model ${model} responded in ${elapsedMs}ms`);
  return text;
}

/**
 * Executes a prompt with pure OpenRouter multi-model fallback:
 * 1. OpenRouter Primary Model (default: apodex/apodex-1.1-mini:free)
 * 2. OpenRouter Fallback Model (default: liquid/lfm-2.5-2.6b:free)
 * 3. OpenRouter Tertiary Safety Model (inclusionai/ling-3.1-flash)
 */
export async function executeAiCompletion(
  options: CompletionOptions
): Promise<ModelAttemptResult> {
  const { primaryModel, fallbackModel } = getAiConfig();

  // 1. Try Primary OpenRouter model
  try {
    const content = await callOpenRouter(primaryModel, options);
    return { modelUsed: primaryModel, provider: 'OpenRouter-Primary', content };
  } catch (primaryErr: any) {
    console.warn(`[AI Engine] Primary OpenRouter model (${primaryModel}) failed: ${primaryErr.message}. Trying fallback model...`);

    // 2. Try Fallback OpenRouter model
    try {
      const content = await callOpenRouter(fallbackModel, options);
      return { modelUsed: fallbackModel, provider: 'OpenRouter-Fallback', content };
    } catch (fallbackErr: any) {
      console.warn(`[AI Engine] Fallback OpenRouter model (${fallbackModel}) failed: ${fallbackErr.message}. Trying tertiary tier...`);

      // 3. Try Tertiary OpenRouter model
      const tertiaryModel = 'inclusionai/ling-3.1-flash';
      try {
        const content = await callOpenRouter(tertiaryModel, options);
        return { modelUsed: tertiaryModel, provider: 'OpenRouter-Tertiary', content };
      } catch (tertiaryErr: any) {
        console.error(`[AI Engine] All OpenRouter models failed: ${primaryErr.message} / ${fallbackErr.message} / ${tertiaryErr.message}`);
        throw new Error('All configured OpenRouter AI models failed. Check your API key or model quotas.');
      }
    }
  }
}

/**
 * Safely parses JSON from an LLM response string, stripping code blocks
 * and repairing clipped/unclosed JSON objects.
 */
export function extractAndParseJson<T>(raw: string): T {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```\s*$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }

  // 1. Direct parse attempt
  try {
    return JSON.parse(cleaned) as T;
  } catch {}

  // 2. Full { ... } match attempt
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]) as T;
    } catch {}
  }

  // 3. Repair unclosed JSON if truncated
  const firstBrace = cleaned.indexOf('{');
  if (firstBrace !== -1) {
    let sub = cleaned.slice(firstBrace).trim();
    // Strip trailing incomplete property or dangling quote/comma
    sub = sub.replace(/,\s*"?[a-zA-Z0-9_]*"?\s*:?\s*"?[^"]*$/, '');
    sub = sub.replace(/,\s*$/, '');
    
    // Try auto-closing
    const candidates = [
      sub + '"}',
      sub + '}',
      sub + '"}'
    ];

    for (const cand of candidates) {
      try {
        return JSON.parse(cand) as T;
      } catch {}
    }
  }

  throw new Error(`Failed to parse structured JSON: ${raw}`);
}
