const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_CHARS = 40000;
const MAX_CSS_CHARS = 20000;
const MAX_STYLESHEETS = 3;

export interface ScrapedPage {
  html: string;
  css: string;
  fonts: string[];
  domain: string;
  title: string;
}

/**
 * Best-effort, single-attempt fetch of a page's HTML plus its linked CSS. No
 * headless rendering, no retries, no anti-bot workarounds — if this throws,
 * the caller is expected to fall back to the screenshot path, not retry harder.
 */
export async function scrapePage(url: string): Promise<ScrapedPage> {
  const parsed = new URL(url);
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const html = await res.text();

  const title = extractTag(html, 'title');
  const inlineStyles = extractAll(html, /<style[^>]*>([\s\S]*?)<\/style>/gi);
  const stylesheetHrefs = extractAll(
    html,
    /<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi
  ).slice(0, MAX_STYLESHEETS);

  const externalCss = await Promise.all(
    stylesheetHrefs.map(async (href) => {
      try {
        const absolute = new URL(href, url).toString();
        const r = await fetchWithTimeout(absolute);
        return r.ok ? await r.text() : '';
      } catch {
        return '';
      }
    })
  );

  const css = [...inlineStyles, ...externalCss].join('\n').slice(0, MAX_CSS_CHARS);
  const fonts = extractFonts(css);
  const cleanedHtml = stripNoise(html).slice(0, MAX_HTML_CHARS);

  return { html: cleanedHtml, css, fonts, domain: parsed.hostname, title };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; ref-to-prompt/0.1; +https://github.com)',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function extractTag(html: string, tag: string): string {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return match ? match[1].trim() : '';
}

function extractAll(html: string, pattern: RegExp): string[] {
  return [...html.matchAll(pattern)].map((m) => m[1]);
}

function extractFonts(css: string): string[] {
  const declarations = extractAll(css, /font-family\s*:\s*([^;}"']+)/gi);
  const names = declarations.flatMap((decl) =>
    decl.split(',').map((n) => n.trim().replace(/^["']|["']$/g, ''))
  );
  return [...new Set(names)].filter(Boolean);
}

function stripNoise(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}
