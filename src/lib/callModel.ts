import type { ScrapedPage } from './scrape';
import type { Provider } from '../types';
import { callAnalyzeModel as callAnthropic } from './anthropic';
import { callOpenRouterModel } from './openrouter';
import type { RepairRequest } from './repairPrompt';

interface CallModelParams {
  provider: Provider;
  apiKey: string;
  openRouterModel?: string;
  systemPrompt: string;
  description: string;
  scraped?: Pick<ScrapedPage, 'html' | 'css' | 'title'>;
  screenshotBase64?: string;
  /** Présent en seconde tentative : remplace l'analyse par une correction ciblée. */
  repair?: RepairRequest;
}

/**
 * BYOK dispatch: the API key always comes from the client, per request. Nothing
 * is stored or logged server-side — the key is forwarded straight to the chosen
 * provider and discarded once the request completes.
 */
export async function callModel(params: CallModelParams): Promise<string> {
  if (params.provider === 'openrouter') {
    if (!params.openRouterModel) {
      throw new Error('Modèle OpenRouter manquant');
    }
    return callOpenRouterModel({
      apiKey: params.apiKey,
      model: params.openRouterModel,
      systemPrompt: params.systemPrompt,
      description: params.description,
      scraped: params.scraped,
      screenshotBase64: params.screenshotBase64,
      repair: params.repair,
    });
  }

  return callAnthropic({
    apiKey: params.apiKey,
    systemPrompt: params.systemPrompt,
    description: params.description,
    scraped: params.scraped,
    screenshotBase64: params.screenshotBase64,
    repair: params.repair,
  });
}
