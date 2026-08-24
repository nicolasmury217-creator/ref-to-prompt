import type { Correction } from '../types';

/**
 * Ton informatif, pas alarmant : le filet a fonctionné. L'utilisateur a un résultat
 * valide, on lui dit simplement qu'il a fallu s'y reprendre à deux fois.
 */
export function CorrectionNotice({ correction }: { correction: Correction }) {
  return (
    <div className="rounded border border-sky-900/60 bg-sky-950/30 p-3 text-xs">
      <p className="text-sky-300">
        Première sortie rejetée par le filtre anti-littéral, corrigée automatiquement.
      </p>
      <ul className="mt-1 list-disc list-inside text-sky-400/80">
        {correction.motifs.map((motif) => (
          <li key={motif}>{motif}</li>
        ))}
      </ul>
    </div>
  );
}
