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
// Deliberately not global: this one is used with .test(), and a /g regex kept at
// module scope carries lastIndex between calls — which made every second request
// with an rgb()/hsl() literal pass the filter.
const RGB_HSL_RE = /\b(rgb|rgba|hsl|hsla)\s*\(/i;

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
 * Whole-word, accent-aware, case-insensitive containment.
 *
 * Font and brand tokens must never be matched as bare substrings: "Inter" is one
 * of the most common web fonts, and the system prompt explicitly asks the model
 * to write about "micro-interactions" — so substring matching rejected every
 * correctly-abstracted output for any page served in Inter. Same class of bug for
 * "sometimes" vs Times, or "des stripes" vs stripe.com.
 *
 * Word boundaries are defined on Unicode letters/digits rather than \b so that
 * French accented prose ("intérieur", "épuré") delimits tokens correctly.
 */
function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'iu').test(haystack);
}

/**
 * Rejects (never silently cleans) any AnalyzeResult that still carries a literal
 * value traceable to the source page: exact colors, source font names, or the
 * source domain/brand. Runs server-side, after model generation.
 */
export function filterLiterals(result: AnalyzeResult, ctx: FilterContext): FilterFailure | null {
  const reasons: string[] = [];
  const fullText = JSON.stringify(result);

  const hexMatches = fullText.match(HEX_COLOR_RE);
  if (hexMatches) {
    reasons.push(`code(s) couleur hex détecté(s): ${[...new Set(hexMatches)].join(', ')}`);
  }

  if (RGB_HSL_RE.test(fullText)) {
    reasons.push('fonction couleur rgb()/hsl() détectée');
  }

  for (const font of ctx.fonts) {
    const normalized = font.trim().toLowerCase();
    if (normalized.length >= 3 && !GENERIC_FONT_KEYWORDS.has(normalized) && containsWord(fullText, normalized)) {
      reasons.push(`nom de police source détecté: "${font.trim()}"`);
    }
  }

  if (ctx.domain) {
    const brandGuess = ctx.domain.replace(/^www\./, '').split('.')[0];
    if (brandGuess.length >= 3 && containsWord(fullText, brandGuess)) {
      reasons.push(`nom de domaine/marque source détecté: "${brandGuess}"`);
    }
  }

  return reasons.length ? { rejected: true, reasons } : null;
}
