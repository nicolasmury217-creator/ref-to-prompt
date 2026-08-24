import type { Tension } from '../types';

export function TensionsBlock({ items }: { items: Tension[] }) {
  // Defensive: a weak model occasionally splits {constat, arbitrage} into two
  // separate objects, each carrying only one field. Render whichever field a
  // given item actually has rather than dropping the whole entry.
  const valid = items.filter(
    (item) => item && (typeof item.constat === 'string' || typeof item.arbitrage === 'string')
  );

  return (
    <section>
      <h2 className="text-sm font-medium text-amber-400 uppercase tracking-wide mb-3">
        Tensions &amp; arbitrages
      </h2>
      <div className="space-y-3">
        {valid.map((item, i) => (
          <div key={i} className="rounded border border-amber-800/40 bg-amber-950/20 p-4 space-y-2">
            {typeof item.constat === 'string' && (
              <p className="text-sm text-amber-100 leading-relaxed">
                <span className="font-semibold text-amber-300">Constat — </span>
                {item.constat}
              </p>
            )}
            {typeof item.arbitrage === 'string' && (
              <p className="text-sm text-amber-100/90 leading-relaxed">
                <span className="font-semibold text-amber-300">Arbitrage — </span>
                {item.arbitrage}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
