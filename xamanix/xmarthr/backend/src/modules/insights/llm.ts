import { env } from '../../core/env';

/**
 * Optional LLM layer (OpenAI-compatible). When no key is set, askLlm returns null
 * and callers fall back to a deterministic summary. The model only ever receives
 * pre-aggregated metrics — never raw employee records.
 */
export const llmEnabled = (): boolean => Boolean(env.openaiApiKey);

export async function askLlm(system: string, user: string): Promise<string | null> {
  if (!llmEnabled()) return null;
  try {
    const res = await fetch(`${env.openaiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: env.openaiModel, temperature: 0.2, max_tokens: 500, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    });
    if (!res.ok) { console.error('[llm] HTTP', res.status); return null; }
    const json: any = await res.json();
    return json?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error('[llm] error', err);
    return null;
  }
}
