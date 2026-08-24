import type { AnalyzeResult } from '../types';

export interface FilterContext {
  fonts: string[];
  domain?: string;
}

export interface FilterFailure {
  rejected: true;
  reasons: string[];
}

const HEX_COLOR_RE = /#[0-9a-fA-F]{3,8}\b/g;
const RGB_HSL_RE = /\b(rgb|rgba|hsl|hsla)\s*\(/gi;

const GENERIC_FONT_KEYWORDS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'inherit',
  'initial',
  'unset',
]);

/**
 * Rejects (never silently cleans) any AnalyzeResult that still carries a literal
 * value traceable to the source page: exact colors, source font names, or the
 * source domain/brand. Runs server-side, after model generation.
 */
export function filterLiterals(result: AnalyzeResult, ctx: FilterContext): FilterFailure | null {
  const reasons: string[] = [];
  const fullText = JSON.stringify(result);
  const lowerText = fullText.toLowerCase();

  const hexMatches = fullText.match(HEX_COLOR_RE);
  if (hexMatches) {
    reasons.push(`code(s) couleur hex détecté(s): ${[...new Set(hexMatches)].join(', ')}`);
  }

  if (RGB_HSL_RE.test(fullText)) {
    reasons.push('fonction couleur rgb()/hsl() détectée');
  }

  for (const font of ctx.fonts) {
    const normalized = font.trim().toLowerCase();
    if (normalized.length >= 3 && !GENERIC_FONT_KEYWORDS.has(normalized) && lowerText.includes(normalized)) {
      reasons.push(`nom de police source détecté: "${font.trim()}"`);
    }
  }

  if (ctx.domain) {
    const brandGuess = ctx.domain.replace(/^www\./, '').split('.')[0];
    if (brandGuess.length >= 3 && lowerText.includes(brandGuess.toLowerCase())) {
      reasons.push(`nom de domaine/marque source détecté: "${brandGuess}"`);
    }
  }

  return reasons.length ? { rejected: true, reasons } : null;
}
