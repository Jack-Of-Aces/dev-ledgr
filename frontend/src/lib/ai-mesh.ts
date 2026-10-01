/**
 * @file ai-mesh.ts
 * @description Resilient Multi-Provider AI Orchestration Mesh.
 * Cascades across modern, non-deprecated models from Google Gemini and Groq with
 * automatic failover, timeout protection, and graceful heuristic fallbacks.
 */

// Modern, actively supported Gemini models in order of capability/speed
export const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
] as const;

// Modern, actively supported Groq models in order of capability/speed
export const GROQ_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
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
      maxOutputTokens: options.maxTokens ?? 3500,
    };

    // For Gemini 2.5 models, thinking tokens count against maxOutputTokens.
    // Setting thinkingBudget: 0 disables excessive chain-of-thought token burn
    // so the candidate receives immediate, comprehensive, complete technical prose.
    if (model.includes('gemini-2.5') || model.includes('gemini-3')) {
      generationConfig.thinkingConfig = {
        thinkingBudget: 0,
      };
    }

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
      max_tokens: options.maxTokens ?? 3500,
    };

    if (options.jsonMode) {
      requestBody.response_format = { type: 'json_object' };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DevLedgr/1.0',
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
 * Builds the cascading provider/model plan based on provided keys.
 */
function buildMeshPlan(options: AIMeshOptions): Array<
  | { provider: 'gemini'; model: GeminiModel; key: string }
  | { provider: 'groq'; model: GroqModel; key: string }
> {
  const userKey = options.userApiKey?.trim() || '';
  const isGroqUserKey = userKey.startsWith('gsk_');

  const geminiApiKey =
    (!isGroqUserKey && userKey) ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    '';

  const groqApiKey =
    (isGroqUserKey && userKey) ||
    process.env.GROQ_API_KEY ||
    '';

  const plan: Array<
    | { provider: 'gemini'; model: GeminiModel; key: string }
    | { provider: 'groq'; model: GroqModel; key: string }
  > = [];

  if (isGroqUserKey && groqApiKey) {
    for (const model of GROQ_MODELS) {
      plan.push({ provider: 'groq', model, key: groqApiKey });
    }
    if (geminiApiKey) {
      for (const model of GEMINI_MODELS) {
        plan.push({ provider: 'gemini', model, key: geminiApiKey });
      }
    }
  } else {
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

  return plan;
}

/**
 * Streams tokens from Google Gemini via streamGenerateContent?alt=sse.
 */
async function* callGeminiStream(
  model: GeminiModel,
  apiKey: string,
  options: AIMeshOptions
): AsyncGenerator<string, void, unknown> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  let combinedText = options.prompt;
  if (options.systemInstruction) {
    combinedText = `${options.systemInstruction}\n\nCandidate Request / Prompt:\n${options.prompt}`;
  }

  const generationConfig: Record<string, unknown> = {
    temperature: options.temperature ?? 0.35,
    maxOutputTokens: options.maxTokens ?? 8192,
  };

  if (model.includes('gemini-2.5') || model.includes('gemini-3')) {
    generationConfig.thinkingConfig = {
      thinkingBudget: 0,
    };
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: combinedText }] }],
      generationConfig,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini Stream [${model}] HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }

  if (!res.body) {
    throw new Error(`Gemini Stream [${model}] returned empty response body`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const parts = parsed?.candidates?.[0]?.content?.parts ?? [];
            for (const part of parts) {
              if (part.text) {
                yield part.text;
              }
            }
          } catch {
            // Partial or malformed SSE line, skip
          }
        }
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      try {
        const parsed = JSON.parse(buffer.trim().slice(6));
        const parts = parsed?.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.text) yield part.text;
        }
      } catch {
        // ignore trailing parse
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Streams tokens from Groq via OpenAI-compatible chat stream.
 */
async function* callGroqStream(
  model: GroqModel,
  apiKey: string,
  options: AIMeshOptions
): AsyncGenerator<string, void, unknown> {
  const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (options.systemInstruction) {
    messages.push({ role: 'system', content: options.systemInstruction });
  }
  messages.push({ role: 'user', content: options.prompt });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'DevLedgr/1.0',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.35,
      max_tokens: options.maxTokens ?? 8192,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq Stream [${model}] HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }

  if (!res.body) {
    throw new Error(`Groq Stream [${model}] returned empty response body`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const payload = trimmed.slice(6);
          if (payload === '[DONE]') return;
          try {
            const parsed = JSON.parse(payload);
            const deltaContent = parsed?.choices?.[0]?.delta?.content;
            if (deltaContent) {
              yield deltaContent;
            }
          } catch {
            // Partial or malformed SSE line, skip
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export interface AIMeshStreamResult {
  stream: AsyncGenerator<string, void, unknown>;
  model: ActiveModel;
  provider: 'gemini' | 'groq' | 'heuristic';
}

/**
 * Cascading AI Mesh Stream Runner.
 * Tries providers in cascade order and returns the first active token generator.
 */
export async function runAIMeshStream(options: AIMeshOptions): Promise<AIMeshStreamResult> {
  const plan = buildMeshPlan(options);

  for (const step of plan) {
    try {
      const generator =
        step.provider === 'gemini'
          ? callGeminiStream(step.model, step.key, options)
          : callGroqStream(step.model, step.key, options);

      // Probe first yield to guarantee connection and model validity before committing
      const firstIter = await generator.next();

      if (firstIter.done) {
        throw new Error(`Empty stream from ${step.provider}/${step.model}`);
      }

      const initialChunk = firstIter.value as string;

      async function* combinedStream() {
        if (initialChunk) {
          yield initialChunk;
        }
        for await (const chunk of generator) {
          yield chunk;
        }
      }

      return {
        stream: combinedStream(),
        model: step.model,
        provider: step.provider,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[AIMeshStream] Fallback triggered from ${step.provider}/${step.model}: ${errMsg}`);
    }
  }

  // Fallback indicator
  async function* emptyStream() {
    // Empty generator signals to caller to use heuristic stream
  }

  return {
    stream: emptyStream(),
    model: 'heuristic-engine',
    provider: 'heuristic',
  };
}

/**
 * Cascading AI Mesh Runner (buffered full text).
 * Iterates through configured models across Gemini and Groq before safely falling back.
 */
export async function runAIMesh(options: AIMeshOptions): Promise<AIMeshResult> {
  const attempts: AIMeshResult['attempts'] = [];
  const plan = buildMeshPlan(options);

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
