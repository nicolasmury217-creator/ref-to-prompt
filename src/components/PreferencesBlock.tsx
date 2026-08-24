import type { Preference } from '../types';

export function PreferencesBlock({ items }: { items: Preference[] }) {
  // Defensive: a model occasionally breaks an {axe, demande} object into loose
  // array entries. Skip anything that isn't a proper object with both fields.
  const valid = items.filter(
    (item) => item && typeof item.axe === 'string' && typeof item.demande === 'string'
  );

  return (
    <section>
      <h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wide mb-3">
        Préférences exprimées
      </h2>
      <dl className="space-y-3">
        {valid.map((item, i) => (
          <div key={`${item.axe}-${i}`} className="rounded border border-neutral-800 bg-neutral-900 p-4">
            <dt className="text-sm font-semibold text-neutral-200 mb-1">{item.axe}</dt>
            <dd className="text-sm text-neutral-400 leading-relaxed">{item.demande}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
