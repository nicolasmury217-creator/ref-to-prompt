export interface GrammairePrincipe {
  axe: 'Contraste' | 'Typographie' | 'Densité' | 'Rétention' | 'Mouvement';
  principe: string;
}

export interface Preference {
  axe: string;
  demande: string;
}

export interface Tension {
  constat: string;
  arbitrage: string;
}

export interface AnalyzeResult {
  grammaire: GrammairePrincipe[];
  preferences: Preference[];
  tensions: Tension[];
  prompt: string;
}

/**
 * Trace d'une relance : ajoutée par le serveur, jamais produite par le modèle, et
 * seulement après le passage du filtre — les motifs citent le littéral interdit.
 */
export interface Correction {
  motifs: string[];
}

export interface AnalyzeSuccessResponse extends AnalyzeResult {
  corrige?: Correction;
}

export type Provider = 'anthropic' | 'openrouter';

export interface AnalyzeRequestBody {
  url?: string;
  screenshotBase64?: string;
  description: string;
  provider: Provider;
  apiKey: string;
  openRouterModel?: string;
}

export interface ScrapeFailedResponse {
  scrapeFailed: true;
}

export interface AnalyzeErrorResponse {
  error: string;
  reasons?: string[];
}
