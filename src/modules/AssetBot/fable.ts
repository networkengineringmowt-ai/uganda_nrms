/**
 * fable — LLM brain for the Road Asset Bot, powered by Claude Fable 5.
 *
 * Key handling (the deployed site is public GitHub Pages, so NO API key ever
 * ships in this bundle):
 *   1. If the local write-back server (server/index.js) is running, chat is
 *      proxied through it — the key stays server-side in server/.env.
 *   2. Else, an operator may paste their own Anthropic API key in the bot's
 *      settings; it is stored in THIS BROWSER's localStorage only and sent
 *      directly to the Claude API (official SDK, dangerouslyAllowBrowser).
 *   3. Neither available → returns null and the bot falls back to its
 *      rule-based quick queries.
 *
 * The Anthropic SDK is dynamically imported so it stays out of the main bundle.
 */

export interface FableTurn {
  role: 'user' | 'assistant';
  content: string;
}

const MODEL = 'claude-fable-5';
const MAX_TOKENS = 2048;
const SERVER_URL = 'http://localhost:3001/api/bot/chat';
const KEY_STORAGE = 'anthropic_api_key';

// Remember a failed server probe so we don't pay the timeout on every message.
let serverDown = false;

export function getApiKey(): string | null {
  try { return localStorage.getItem(KEY_STORAGE); } catch { return null; }
}
export function setApiKey(key: string | null): void {
  try {
    if (key && key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
    else localStorage.removeItem(KEY_STORAGE);
  } catch { /* storage unavailable */ }
}
export function llmConfigured(): boolean {
  return !serverDown || !!getApiKey();
}

function systemPrompt(dataContext: string): string {
  return [
    'You are the Road Asset Intelligence Bot for the Uganda National Roads Platform',
    '(Department of National Roads, Ministry of Works & Transport).',
    'Answer questions about Uganda\'s national road network: condition (IRI/PCI/VCI),',
    'rehabilitation needs, traffic, overloading/ESAL, budgets, bridges and road reserves.',
    'Ground every number you state in the DATA CONTEXT below; if the context does not',
    'contain the answer, say so plainly and suggest which platform section may help.',
    'Be concise (a short paragraph or compact bullet list). Use **bold** for key figures.',
    'Grading and inventory terminology follows the UNRA Visual Inspections manual (Feb 2012).',
    '',
    '=== DATA CONTEXT (live platform datasets) ===',
    dataContext,
  ].join('\n');
}

async function viaServer(history: FableTurn[], dataContext: string): Promise<string | null> {
  if (serverDown) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, system: systemPrompt(dataContext) }),
      signal: ctrl.signal,
    });
    if (!r.ok) { serverDown = true; return null; }
    const j = await r.json();
    return typeof j.text === 'string' ? j.text : null;
  } catch {
    serverDown = true;
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function viaBrowser(history: FableTurn[], dataContext: string): Promise<string | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system: systemPrompt(dataContext),
    messages: history,
  });
  const block = response.content.find(b => b.type === 'text');
  return block && block.type === 'text' ? block.text : null;
}

/**
 * Ask Fable 5. Returns the answer text, or null if no LLM route is available
 * (caller should fall back to rule-based behaviour). Throws on real API errors
 * (bad key, rate limit) so the caller can surface them.
 */
export async function askFable(history: FableTurn[], dataContext: string): Promise<string | null> {
  const fromServer = await viaServer(history, dataContext);
  if (fromServer) return fromServer;
  return viaBrowser(history, dataContext);
}
