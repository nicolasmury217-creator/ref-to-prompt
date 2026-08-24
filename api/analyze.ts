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
  // fallback exists only to spare the operator retyping a key while developing
  // locally, so it is gated on the environment rather than on the operator
  // remembering not to set these variables in production. Without that gate a
  // stray OPENROUTER_API_KEY on the host would silently bill the operator for
  // every visitor's request — the exact opposite of the BYOK model.
  const allowEnvFallback = process.env.NODE_ENV !== 'production';

  const resolvedApiKey =
    (typeof apiKey === 'string' && apiKey.trim()) ||
    (allowEnvFallback
      ? resolvedProvider === 'openrouter'
        ? process.env.OPENROUTER_API_KEY
        : process.env.ANTHROPIC_API_KEY
      : undefined);

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

  const filterContext = {
    fonts: scraped?.fonts ?? [],
    domain: scraped?.domain,
  };

  const baseCall = {
    provider: resolvedProvider,
    apiKey: resolvedApiKey,
    openRouterModel: resolvedOpenRouterModel,
    systemPrompt: SYSTEM_PROMPT,
    description,
    scraped,
    screenshotBase64,
  };

  let rawText: string;
  try {
    rawText = await callModel(baseCall);
  } catch (err) {
    res.status(502).json({ error: `Appel au modèle échoué: ${(err as Error).message}` });
    return;
  }

  const parsed = parseModelJson(rawText);
  if (!parsed.ok) {
    res.status(502).json({ error: 'Réponse du modèle non-JSON' });
    return;
  }

  const failure = filterLiterals(parsed.result, filterContext);
  if (!failure) {
    res.status(200).json(parsed.result);
    return;
  }

  if (process.env.DEBUG_FILTER) {
    console.error('[literalFilter] rejected. raw result:', JSON.stringify(parsed.result, null, 2));
  }

  // Une seule réparation, jamais deux : chaque tentative coûte jusqu'à plusieurs
  // minutes avec un modèle gratuit. On ne re-scrape pas non plus — le rejet vient
  // de la rédaction du modèle, pas de la page, qui est déjà en mémoire.
  const repaired = await attemptRepair({
    baseCall,
    rejected: parsed.result,
    reasons: failure.reasons,
    filterContext,
  });

  if (!repaired) {
    res.status(422).json({
      error: 'Sortie rejetée: littéral résiduel détecté',
      reasons: failure.reasons,
    });
    return;
  }

  // `corrige` est attaché APRÈS le filtrage, jamais avant : les motifs citent le
  // littéral interdit lui-même (« marque source détectée: "linear" »), et
  // filterLiterals sérialise l'objet entier avant de le scanner. L'ajouter en amont
  // ferait rejeter une sortie pourtant corrigée, à cause de sa propre explication.
  res.status(200).json({ ...repaired, corrige: { motifs: failure.reasons } });
}

interface RepairAttempt {
  baseCall: Parameters<typeof callModel>[0];
  rejected: AnalyzeResult;
  reasons: string[];
  filterContext: { fonts: string[]; domain?: string };
}

/**
 * Redemande au modèle de corriger uniquement les passages fautifs. Renvoie la
 * sortie réparée, ou null si la réparation a échoué — pour quelque raison que ce
 * soit. L'appelant affiche alors le rejet d'origine : c'est l'information utile
 * pour l'utilisateur, plus qu'une erreur technique de seconde main.
 */
async function attemptRepair({
  baseCall,
  rejected,
  reasons,
  filterContext,
}: RepairAttempt): Promise<AnalyzeResult | null> {
  let rawText: string;
  try {
    rawText = await callModel({
      ...baseCall,
      repair: { rejectedJson: JSON.stringify(rejected), reasons },
    });
  } catch (err) {
    if (process.env.DEBUG_FILTER) {
      console.error('[repair] appel modèle échoué:', (err as Error).message);
    }
    return null;
  }

  const parsed = parseModelJson(rawText);
  if (!parsed.ok) {
    if (process.env.DEBUG_FILTER) {
      console.error('[repair] réponse non-JSON, longueur:', rawText.length, '\n---\n', rawText, '\n---');
    }
    return null;
  }

  const stillFailing = filterLiterals(parsed.result, filterContext);
  if (stillFailing) {
    if (process.env.DEBUG_FILTER) {
      console.error('[repair] toujours rejeté:', stillFailing.reasons.join(' | '));
    }
    return null;
  }

  return parsed.result;
}

type ParseOutcome = { ok: true; result: AnalyzeResult } | { ok: false };

/**
 * Vérifie la FORME, pas seulement la validité JSON.
 *
 * jsonrepair est volontairement permissif : sur de la prose comme « désolé, je ne
 * peux pas », il produit un tableau JSON parfaitement valide. Sans ce garde-fou,
 * cette bouillie franchissait le filtre — qui n'y trouve aucun littéral, forcément —
 * et repartait en 200, faisant planter l'affichage au premier `.map()`.
 */
function looksLikeAnalyzeResult(value: unknown): value is AnalyzeResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.grammaire) &&
    Array.isArray(candidate.preferences) &&
    Array.isArray(candidate.tensions) &&
    typeof candidate.prompt === 'string'
  );
}

function parseModelJson(rawText: string): ParseOutcome {
  const cleaned = stripJsonFences(rawText);

  // Weaker models occasionally leave a stray unescaped quote or trailing comma
  // inside an otherwise-valid JSON object. jsonrepair fixes exactly this class of
  // near-miss before we give up and surface an error.
  for (const tentative of [() => JSON.parse(cleaned), () => JSON.parse(jsonrepair(cleaned))]) {
    try {
      const value = tentative();
      if (looksLikeAnalyzeResult(value)) return { ok: true, result: value };
    } catch {
      // essai suivant
    }
  }

  if (process.env.DEBUG_FILTER) {
    console.error('[analyze] sortie inexploitable. longueur:', rawText.length, '\n---\n', rawText, '\n---');
  }
  return { ok: false };
}

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenceMatch ? fenceMatch[1] : trimmed;
}
