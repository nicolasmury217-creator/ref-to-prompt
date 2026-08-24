# Jalon 3 — relance automatique sur rejet du filtre

Date : 2026-08-24
État : validé, à implémenter

## Problème

`/api/analyze` rejette (HTTP 422) toute sortie où le filtre anti-littéral détecte
une valeur traçable à la page source. Le rejet est justifié — un run réel sur
`linear.app` a produit « reprend la discipline structurelle de **Linear** » dans le
prompt final — mais l'utilisateur n'a aucun recours : il a attendu 1 à 4 minutes avec
un modèle gratuit et reçoit un bandeau rouge.

Un rejet est un défaut de notre chaîne de qualité, pas une erreur de l'utilisateur.
Il ne devrait pas avoir à agir pour le réparer.

## Décision

Relance **automatique, côté serveur, une seule fois**, en demandant au modèle de
**corriger sa propre sortie** plutôt que de tout regénérer.

Corriger plutôt que regénérer, parce qu'un rejet tient généralement à un seul mot
dans un texte de 400 : tout refaire jetterait une analyse en cinq axes réussie, et la
nouvelle tentative pourrait fuiter ailleurs. La tâche est aussi plus étroite, donc
plus à portée d'un modèle gratuit.

La page n'est **pas** re-scrapée : le contenu est déjà en mémoire.

## Flux

```
scrape
  └─ tentative 1 : appel modèle (analyse) → parse JSON → filterLiterals
       ├─ accepté → 200
       └─ rejeté  → tentative 2 : appel modèle (réparation)
                      → parse JSON → filterLiterals
                        ├─ accepté → 200 + trace de la correction
                        └─ rejeté  → 422, motifs des deux tentatives
```

## Passage de la requête de réparation

Les modules providers (`anthropic.ts`, `openrouter.ts`) construisent eux-mêmes le
message utilisateur, parce que les formats d'image diffèrent entre les deux. Une
requête de réparation est en revanche **du texte pur, identique pour les deux**.

On ajoute donc un champ optionnel `repair` aux paramètres providers : présent, il
remplace le contenu utilisateur par un texte construit par un module partagé
(`src/lib/repairPrompt.ts`). Le chemin d'analyse reste inchangé.

Rejeté : détourner le champ `description` pour y glisser les motifs (ment sur la
sémantique) ; généraliser les providers à des messages arbitraires (refonte
disproportionnée, et les formats d'image justifient la construction locale).

## Contenu du message de réparation

- le JSON rejeté, tel quel
- les motifs exacts renvoyés par `filterLiterals`
- la consigne : réécrire **uniquement** les passages fautifs, préserver le reste mot
  pour mot, renvoyer le JSON complet au même schéma

La règle absolue du prompt système d'origine est rappelée, puisque c'est elle qui a
été enfreinte.

## Contrat d'API

Réponse 200, inchangée, plus un champ optionnel ajouté **par le serveur** :

```ts
interface AnalyzeSuccessResponse extends AnalyzeResult {
  corrige?: { motifs: string[] };  // motifs du rejet de la 1re tentative
}
```

Réponse 422, quand la réparation échoue elle aussi :

```ts
{ error: string; reasons: string[]; motifsPremiereTentative?: string[] }
```

## Piège à ne pas manquer

`corrige` doit être attaché **après** l'appel à `filterLiterals`, jamais avant.

Les motifs contiennent le littéral interdit lui-même — `nom de domaine/marque source
détecté: "linear"`. Comme `filterLiterals` sérialise l'objet entier avant de le
scanner, ajouter `corrige` en amont ferait rejeter une sortie pourtant corrigée, à
cause de sa propre explication. Boucle absurde et impossible à diagnostiquer.

## Comportements d'échec

| Situation | Réponse |
|---|---|
| Réparation renvoie du non-JSON, même après `jsonrepair` | 422 avec les motifs d'origine |
| Réparation rejetée par le filtre | 422, motifs des deux tentatives |
| Appel modèle de réparation en erreur réseau | 422 avec les motifs d'origine |

Dans les trois cas on affiche le rejet d'origine plutôt qu'une erreur technique de
seconde main : c'est l'information utile pour l'utilisateur. L'échec de la réparation
est journalisé sous `DEBUG_FILTER`.

Une seule réparation, jamais deux : chaque tentative coûte jusqu'à 4 minutes.

## Interface

Bandeau sobre au-dessus des résultats quand `corrige` est présent : « Première sortie
rejetée (motif), corrigée automatiquement ». Ton informatif, pas alarmant — le filet
a fonctionné.

Le texte d'attente mentionne que deux tentatives sont possibles.

## Vérification

Un script `npm run check`, sans dépendance ajoutée, sur la technique
`vite ssrLoadModule` déjà employée. Il couvre :

- le filtre anti-littéral : 6 cas à rejeter, 6 à accepter, sur 3 tours consécutifs
  (un tour unique masquerait une regex à état)
- la garantie BYOK : clé opérateur refusée en production, repli actif en dev
- les chemins de relance, avec un appel modèle simulé : succès direct, réparation
  réussie, réparation rejetée, réparation non-JSON
- l'absence d'auto-rejet : une sortie corrigée dont les motifs contiennent le
  littéral doit sortir en 200

Ces vérifications vivent aujourd'hui dans un dossier temporaire et seraient perdues.

## Hors périmètre

- Progression en direct (SSE) : changement de protocole, à reconsidérer si l'attente
  reste le principal irritant
- Plus d'une réparation
- Mémorisation de la clé API côté navigateur
