import type { ZodType } from 'zod';

/**
 * Provider-agnostic AI wrapper (plain fetch, no SDK dependencies).
 * Routes only call `generateJson`; the provider is picked from env:
 *   AI_PROVIDER=gemini | anthropic   (if unset: auto-detected from whichever key is present)
 */
const TIMEOUT_MS = 45_000;

export class AiError extends Error {
  constructor(message: string, public status = 502, public retryable = false) {
    super(message);
    this.name = 'AiError';
  }
}

interface GenerateOptions<T> {
  system: string;
  prompt: string;
  schema: ZodType<T>;
  maxTokens?: number;
}

interface ProviderRequest {
  system: string;
  prompt: string;
  maxTokens: number;
  signal: AbortSignal;
}

type Provider = {
  name: 'gemini' | 'anthropic';
  model: string;
  call: (req: ProviderRequest) => Promise<string>;
};

/* ---------------- Gemini (Google AI Studio key) ---------------- */
// Free-tier quota is per model, so chaining models multiplies daily capacity.
// GEMINI_MODEL accepts a comma-separated list, tried in order.
const DEFAULT_GEMINI_MODELS =
  'gemini-3.5-flash,gemini-3.6-flash,gemini-3.7-flash,gemini-3.8-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite';
const PER_MINUTE_COOLDOWN_MS = 60_000;
const PER_DAY_COOLDOWN_MS = 60 * 60_000; // re-probe hourly; a 429 doesn't consume quota

const gemini = (apiKey: string): Provider => {
  const models = (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODELS)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const cooldownUntil = new Map<string, number>(); // model -> epoch ms when it may be retried

  return {
    name: 'gemini',
    model: models.join(' → '),
    async call({ system, prompt, maxTokens, signal }) {
      const now = Date.now();
      const available = models.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
      if (!available.length) throw new AiError('Free AI quota used up for now. Try again later.', 503, true);

      let res: Response | undefined;
      for (const model of available) {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: 'POST',
            signal,
            // Key in a header, not the URL query string, so it never ends up in proxy/access logs
            headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: system }] },
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json', // native JSON mode
                temperature: 0.4,
                // Gemini 2.5+ "thinking" tokens count against this budget; leave headroom so JSON isn't cut off
                maxOutputTokens: maxTokens * 3,
              },
            }),
          },
        );
        // 429 = this model's quota is spent; 404 = model retired for this key. Either way, try the next one.
        if (res.status !== 429 && res.status !== 404) break;
        const detail = await res.text().catch(() => '');
        const cooldown =
          res.status === 404 ? Number.POSITIVE_INFINITY : /PerDay/i.test(detail) ? PER_DAY_COOLDOWN_MS : PER_MINUTE_COOLDOWN_MS;
        cooldownUntil.set(model, Date.now() + cooldown);
        console.warn(`[ai] gemini ${model} returned ${res.status}; falling back to next model`);
        res = undefined;
      }
      if (!res) throw new AiError('Free AI quota used up for now. Try again later.', 503, true);
      if (!res.ok) await throwUpstream('gemini', res);

      const data = (await res.json()) as {
        candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
        promptFeedback?: { blockReason?: string };
      };
      if (data.promptFeedback?.blockReason) {
        console.error('[ai] gemini blocked prompt:', data.promptFeedback.blockReason);
        throw new AiError('The AI declined this request. Rephrase your answer and try again.', 422);
      }
      const cand = data.candidates?.[0];
      if (cand?.finishReason === 'MAX_TOKENS') console.warn('[ai] gemini hit MAX_TOKENS; output may be truncated');
      // Skip internal "thought" parts; keep only the answer text
      return (cand?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
    },
  };
};

/* ---------------- Anthropic (Claude Console key) ---------------- */
const anthropic = (apiKey: string): Provider => {
  const model = process.env.AI_MODEL || 'claude-sonnet-5-5';
  return {
    name: 'anthropic',
    model,
    async call({ system, prompt, maxTokens, signal }) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] }),
      });
      if (!res.ok) await throwUpstream('anthropic', res);
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      return (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n');
    },
  };
};

/** Resolve the provider once, lazily (env is loaded before first request). */
let cached: Provider | null = null;
export function getProvider(): Provider {
  if (cached) return cached;
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  const choice = (process.env.AI_PROVIDER?.trim().toLowerCase() || (geminiKey && !anthropicKey ? 'gemini' : 'anthropic')) as
    | 'gemini'
    | 'anthropic';

  if (choice === 'gemini') {
    if (!geminiKey) throw new AiError('Server is missing GEMINI_API_KEY', 500);
    cached = gemini(geminiKey);
  } else if (choice === 'anthropic') {
    if (!anthropicKey) throw new AiError('Server is missing ANTHROPIC_API_KEY (or set AI_PROVIDER=gemini)', 500);
    cached = anthropic(anthropicKey);
  } else {
    throw new AiError(`Unknown AI_PROVIDER "${choice}". Use "gemini" or "anthropic".`, 500);
  }
  return cached;
}

/** Calls the model, extracts JSON, validates against the schema. Retries once on malformed output. */
export async function generateJson<T>({ system, prompt, schema, maxTokens = 2000 }: GenerateOptions<T>): Promise<T> {
  const provider = getProvider();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = await withTimeout((signal) => provider.call({ system, prompt, maxTokens, signal }));
    if (!text) throw new AiError('AI returned an empty response.', 502, true);
    try {
      const parsed = schema.safeParse(JSON.parse(extractJson(text)));
      if (parsed.success) return parsed.data;
      lastError = parsed.error;
    } catch (err) {
      lastError = err;
    }
  }
  console.error(`[ai] invalid ${provider.name} output after retry`, lastError);
  throw new AiError('The AI returned an unexpected response. Try again.', 502, true);
}

async function withTimeout(fn: (signal: AbortSignal) => Promise<string>): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (err instanceof AiError) throw err;
    if ((err as Error).name === 'AbortError') throw new AiError('AI request timed out.', 504, true);
    throw new AiError('Could not reach the AI service.', 502, true);
  } finally {
    clearTimeout(timer);
  }
}

/** Log upstream detail server-side only; never forward it to the browser (may leak config). */
async function throwUpstream(provider: string, res: Response): Promise<never> {
  console.error(`[ai] ${provider} upstream error`, res.status, await res.text().catch(() => ''));
  const retryable = res.status === 429 || res.status >= 500;
  throw new AiError(
    res.status === 429 ? 'AI rate limit reached. Wait a minute and try again.' : retryable ? 'AI service is busy. Try again shortly.' : 'AI request failed.',
    retryable ? 503 : 502,
    retryable,
  );
}

/** Strips markdown fences / leading prose and returns the outermost JSON object. */
function extractJson(text: string): string {
  const cleaned = text.replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object in model output');
  return cleaned.slice(start, end + 1);
}
