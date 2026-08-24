import type { ScrapedPage } from './scrape';
import { fetchWithTimeout, MODEL_CALL_TIMEOUT_MS } from './httpTimeout';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_TOKENS = 8192;

interface CallOpenRouterParams {
  apiKey: string;
  model: string;
  systemPrompt: string;
  description: string;
  scraped?: Pick<ScrapedPage, 'html' | 'css' | 'title'>;
  screenshotBase64?: string;
}

export async function callOpenRouterModel(params: CallOpenRouterParams): Promise<string> {
  const { apiKey, model } = params;

  const res = await fetchWithTimeout(
    OPENROUTER_API_URL,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'http-referer': 'https://github.com',
        'x-title': 'ref-to-prompt',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: buildUserContent(params) },
        ],
      }),
    },
    MODEL_CALL_TIMEOUT_MS
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('Réponse OpenRouter sans contenu');
  }
  return text;
}

function buildUserContent(params: CallOpenRouterParams) {
  if (params.screenshotBase64) {
    return [
      {
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${params.screenshotBase64}` },
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

  throw new Error("Aucune source fournie (ni page scrapée, ni capture d'écran)");
}
