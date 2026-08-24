// Appel modèle simulé, substitué à `src/lib/callModel` le temps des vérifications.
// Piloté par une file de réponses posée sur globalThis par le lanceur, de façon à
// exercer les branches de relance sans dépendre du réseau ni d'une clé API.

export async function callModel(params) {
  const file = globalThis.__REPONSES__;
  if (!Array.isArray(file) || file.length === 0) {
    throw new Error('stub callModel : file de réponses vide (appel non prévu)');
  }
  globalThis.__APPELS__.push({ reparation: Boolean(params.repair), repair: params.repair ?? null });

  const suivante = file.shift();
  if (suivante.erreur) throw new Error(suivante.erreur);
  return suivante.texte;
}
