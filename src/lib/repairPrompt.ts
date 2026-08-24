/**
 * Message de réparation, envoyé quand `filterLiterals` a rejeté une sortie.
 *
 * Texte pur, donc identique pour les deux fournisseurs — c'est précisément ce qui
 * permet de le construire ici plutôt que dans chaque module provider (eux doivent
 * diverger, les formats d'image d'Anthropic et d'OpenRouter n'étant pas les mêmes).
 *
 * On demande une correction ciblée, pas une régénération : un rejet tient
 * généralement à un mot dans un texte de 400, et tout refaire jetterait une analyse
 * réussie tout en risquant de fuiter ailleurs.
 */
export interface RepairRequest {
  rejectedJson: string;
  reasons: string[];
}

export function buildRepairMessage({ rejectedJson, reasons }: RepairRequest): string {
  return [
    'La sortie JSON ci-dessous a été REJETÉE : elle contient encore des valeurs',
    'littérales de la page source, ce que la règle absolue interdit.',
    '',
    'Motifs du rejet :',
    ...reasons.map((r) => `- ${r}`),
    '',
    'Sortie rejetée :',
    rejectedJson,
    '',
    'Corrige-la en respectant strictement ces consignes :',
    '- Réécris UNIQUEMENT les passages qui portent un littéral signalé ci-dessus.',
    '- Préserve tout le reste mot pour mot : les axes, les principes, les tensions et',
    '  les parties saines du prompt ne doivent pas bouger.',
    '- Remplace chaque littéral par le PRINCIPE qui le sous-tend, jamais par un autre',
    '  littéral : ni code couleur, ni nom de police (même inventé), ni nom de marque,',
    '  ni renvoi au site source ou à « la référence ».',
    '- Le champ "prompt" doit rester auto-suffisant : celui qui le lira n\'aura jamais',
    '  accès à la page d\'origine.',
    '',
    'Réponds UNIQUEMENT avec le JSON complet corrigé, au même schéma, sans texte',
    'avant ni après, et sans guillemets doubles à l\'intérieur du champ "prompt".',
  ].join('\n');
}
