import type { GrammairePrincipe } from '../types';

export function GrammaireBlock({ items }: { items: GrammairePrincipe[] }) {
  // Defensive: a model occasionally malforms a key (e.g. typos the field name).
  // Skip anything that doesn't have both fields rather than render broken text.
  const valid = items.filter(
    (item) => item && typeof item.axe === 'string' && typeof item.principe === 'string'
  );

  return (
    <section>
      <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
        Grammaire de composition
      </h2>
      <dl className="space-y-3">
        {valid.map((item) => (
          <div key={item.axe} className="rounded border border-neutral-800 bg-neutral-900 p-4">
            <dt className="text-sm font-semibold text-neutral-200 mb-1">{item.axe}</dt>
            <dd className="text-sm text-neutral-400 leading-relaxed">{item.principe}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
