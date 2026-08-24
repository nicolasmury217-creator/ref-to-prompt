import type { ScrapedPage } from './scrape';
import { fetchWithTimeout, MODEL_CALL_TIMEOUT_MS } from './httpTimeout';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;

interface CallAnalyzeModelParams {
  apiKey: string;
  systemPrompt: string;
  description: string;
  scraped?: Pick<ScrapedPage, 'html' | 'css' | 'title'>;
  screenshotBase64?: string;
}

export async function callAnalyzeModel(params: CallAnalyzeModelParams): Promise<string> {
  const { apiKey } = params;
  const content = buildContentBlocks(params);

  const res = await fetchWithTimeout(
    ANTHROPIC_API_URL,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: params.systemPrompt,
        messages: [{ role: 'user', content }],
      }),
    },
    MODEL_CALL_TIMEOUT_MS
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>;
  };
  const textBlock = data.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    throw new Error('Réponse du modèle sans contenu texte');
  }
  return textBlock.text;
}

function buildContentBlocks(params: CallAnalyzeModelParams) {
  if (params.screenshotBase64) {
    return [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: params.screenshotBase64,
        },
      },
      {
        type: 'text',
        text: `Capture d'écran de la page de référence.\n\nDescription de l'utilisateur:\n${params.description}`,
      },
    ];
  }

  if (params.scraped) {
    return [
      {
        type: 'text',
        text: [
          `Titre de la page: ${params.scraped.title}`,
          `CSS (extrait):\n${params.scraped.css}`,
          `HTML (extrait):\n${params.scraped.html}`,
          `Description de l'utilisateur:\n${params.description}`,
        ].join('\n\n'),
      },
    ];
  }

  throw new Error('Aucune source fournie (ni page scrapée, ni capture d\'écran)');
}
