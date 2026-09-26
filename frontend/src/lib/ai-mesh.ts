/**
 * @file ai-mesh.ts
 * @description Resilient Multi-Provider AI Orchestration Mesh.
 * Cascades across modern, non-deprecated models from Google Gemini and Groq with
 * automatic failover, timeout protection, and graceful heuristic fallbacks.
 */

// Modern, actively supported Gemini models in order of capability/speed
export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
] as const;

// Modern, actively supported Groq models in order of capability/speed
export const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'gemma2-9b-it',
] as const;

export type GeminiModel = typeof GEMINI_MODELS[number];
export type GroqModel = typeof GROQ_MODELS[number];
export type ActiveModel = GeminiModel | GroqModel | 'heuristic-engine';

export interface AIMeshOptions {
  prompt: string;
  systemInstruction?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  userApiKey?: string;
  timeoutMs?: number;
}

export interface AIMeshResult {
  text: string;
  model: ActiveModel;
  provider: 'gemini' | 'groq' | 'heuristic';
  attempts: Array<{
    provider: string;
    model: string;
    status: 'success' | 'failed';
    error?: string;
  }>;
}

/**
 * Executes a single request against Google Gemini REST endpoint.
 */
async function callGemini(
  model: GeminiModel,
  apiKey: string,
  options: AIMeshOptions
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    let combinedText = options.prompt;
    if (options.systemInstruction) {
      combinedText = `${options.systemInstruction}\n\nCandidate Request / Prompt:\n${options.prompt}`;
    }

    contents.push({
      role: 'user',
      parts: [{ text: combinedText }],
    });

    const generationConfig: Record<string, unknown> = {
      temperature: options.temperature ?? 0.4,
      maxOutputTokens: options.maxTokens ?? 1400,
    };

    if (options.jsonMode) {
      generationConfig.responseMimeType = 'application/json';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Gemini [${model}] HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText || typeof candidateText !== 'string') {
      throw new Error(`Gemini [${model}] returned empty or malformed candidate payload.`);
    }

    return candidateText;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Executes a single request against Groq OpenAI-compatible chat endpoint.
 */
async function callGroq(
  model: GroqModel,
  apiKey: string,
  options: AIMeshOptions
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: options.prompt });

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 1400,
    };

    if (options.jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new Error(`Groq [${model}] HTTP ${res.status}: ${errText.slice(0, 150)}`);
    }

    const data = await res.json();
    const candidateText = data.choices?.[0]?.message?.content;

    if (!candidateText || typeof candidateText !== 'string') {
      throw new Error(`Groq [${model}] returned empty or malformed message content.`);
    }

    return candidateText;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cascading AI Mesh Runner.
 * Iterates through configured models across Gemini and Groq before safely falling back.
 */
export async function runAIMesh(options: AIMeshOptions): Promise<AIMeshResult> {
  const attempts: AIMeshResult['attempts'] = [];

  const userKey = options.userApiKey?.trim() || '';
  const isGroqUserKey = userKey.startsWith('gsk_');

  const geminiApiKey = (!isGroqUserKey && userKey) ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

  const groqApiKey = (isGroqUserKey && userKey) ||
    process.env.GROQ_API_KEY ||
    '';

  // Strategy: Try user-specified provider first, then alternate provider
  const plan: Array<
    | { provider: 'gemini'; model: GeminiModel; key: string }
    | { provider: 'groq'; model: GroqModel; key: string }
  > = [];

  if (isGroqUserKey && groqApiKey) {
    // Prioritize Groq models if user gave Groq key
    for (const model of GROQ_MODELS) {
      plan.push({ provider: 'groq', model, key: groqApiKey });
    }
    if (geminiApiKey) {
      for (const model of GEMINI_MODELS) {
        plan.push({ provider: 'gemini', model, key: geminiApiKey });
      }
    }
  } else {
    // Default: Gemini models first, then Groq models
    if (geminiApiKey) {
      for (const model of GEMINI_MODELS) {
        plan.push({ provider: 'gemini', model, key: geminiApiKey });
      }
    }
    if (groqApiKey) {
      for (const model of GROQ_MODELS) {
        plan.push({ provider: 'groq', model, key: groqApiKey });
      }
    }
  }

  // Iterate through model plan with failover
  for (const step of plan) {
    try {
      let output = '';
      if (step.provider === 'gemini') {
        output = await callGemini(step.model, step.key, options);
      } else {
        output = await callGroq(step.model, step.key, options);
      }

      attempts.push({
        provider: step.provider,
        model: step.model,
        status: 'success',
      });

      return {
        text: output,
        model: step.model,
        provider: step.provider,
        attempts,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[AIMesh] Fallback triggered from ${step.provider}/${step.model}: ${errMsg}`);
      attempts.push({
        provider: step.provider,
        model: step.model,
        status: 'failed',
        error: errMsg,
      });
    }
  }

  // If all models failed or no keys present, return empty text indicating heuristic fallback needed
  return {
    text: '',
    model: 'heuristic-engine',
    provider: 'heuristic',
    attempts,
  };
}
