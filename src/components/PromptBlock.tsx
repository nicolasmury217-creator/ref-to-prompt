import { useState } from 'react';

export function PromptBlock({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing to do,
      // the text is still fully selectable/copyable manually below.
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide">
          Prompt à coller
        </h2>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs rounded border border-neutral-700 px-3 py-1.5 text-neutral-300 hover:bg-neutral-800 transition-colors"
        >
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>
      <pre className="rounded border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed">
        {prompt}
      </pre>
    </section>
  );
}
