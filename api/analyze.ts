import type { VercelRequest, VercelResponse } from '@vercel/node';
import { jsonrepair } from 'jsonrepair';
import { scrapePage } from '../src/lib/scrape';
import { callModel } from '../src/lib/callModel';
import { SYSTEM_PROMPT } from '../src/lib/systemPrompt';
import { filterLiterals } from '../src/lib/literalFilter';
import type { AnalyzeResult, Provider } from '../src/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Méthode non autorisée' });
    return;
  }

  const { url, screenshotBase64, description, provider, apiKey, openRouterModel } = (req.body ?? {}) as {
    url?: string;
    screenshotBase64?: string;
    description?: string;
    provider?: string;
    apiKey?: string;
    openRouterModel?: string;
  };

  if (!description || typeof description !== 'string') {
    res.status(400).json({ error: 'description manquante' });
    return;
  }

  const resolvedProvider: Provider = provider === 'openrouter' ? 'openrouter' : 'anthropic';

  // BYOK: the key travels with the request and is never persisted. The env
  // fallback only ever fires locally, when the operator has their own .env
  // set for dev testing — it is never populated in a real deployment.
  const resolvedApiKey =
    (typeof apiKey === 'string' && apiKey.trim()) ||
    (resolvedProvider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.ANTHROPIC_API_KEY);

  if (!resolvedApiKey) {
    res.status(400).json({ error: 'Clé API manquante' });
    return;
  }

  const resolvedOpenRouterModel =
    resolvedProvider === 'openrouter'
      ? (typeof openRouterModel === 'string' && openRouterModel.trim()) || process.env.OPENROUTER_MODEL
      : undefined;

  if (resolvedProvider === 'openrouter' && !resolvedOpenRouterModel) {
    res.status(400).json({ error: 'Modèle OpenRouter manquant' });
    return;
  }

  let scraped: Awaited<ReturnType<typeof scrapePage>> | undefined;

  // Single attempt only. Any failure here — network, timeout, non-2xx, anti-bot
  // wall — falls back to the screenshot path instead of retrying harder.
  if (url && typeof url === 'string' && !screenshotBase64) {
    try {
      scraped = await scrapePage(url);
    } catch {
      res.status(200).json({ scrapeFailed: true });
      return;
    }
  }

  if (!scraped && !screenshotBase64) {
    res.status(400).json({ error: 'url ou screenshotBase64 requis' });
    return;
  }

  let rawText: string;
  try {
    rawText = await callModel({
      provider: resolvedProvider,
      apiKey: resolvedApiKey,
      openRouterModel: resolvedOpenRouterModel,
      systemPrompt: SYSTEM_PROMPT,
      description,
      scraped,
      screenshotBase64,
    });
  } catch (err) {
    res.status(502).json({ error: `Appel au modèle échoué: ${(err as Error).message}` });
    return;
  }

  const cleaned = stripJsonFences(rawText);
  let result: AnalyzeResult;
  try {
    result = JSON.parse(cleaned) as AnalyzeResult;
  } catch {
    // Weaker models occasionally leave a stray unescaped quote or trailing
    // comma inside an otherwise-valid JSON object. jsonrepair fixes exactly
    // this class of near-miss before we give up and surface an error.
    try {
      result = JSON.parse(jsonrepair(cleaned)) as AnalyzeResult;
    } catch {
      if (process.env.DEBUG_FILTER) {
        console.error('[analyze] non-JSON even after repair. raw text length:', rawText.length, '\n---\n', rawText, '\n---');
      }
      res.status(502).json({ error: 'Réponse du modèle non-JSON' });
      return;
    }
  }

  const failure = filterLiterals(result, {
    fonts: scraped?.fonts ?? [],
    domain: scraped?.domain,
  });

  if (failure) {
    if (process.env.DEBUG_FILTER) {
      console.error('[literalFilter] rejected. raw result:', JSON.stringify(result, null, 2));
    }
    res.status(422).json({
      error: 'Sortie rejetée: littéral résiduel détecté',
      reasons: failure.reasons,
    });
    return;
  }

  res.status(200).json(result);
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}
