# référence → prompt de design

Colle l'URL d'un site que tu aimes, décris ce que tu veux construire. L'outil génère
un prompt de création de site — abstrait, jamais littéral — à coller dans un agent de
code (Claude Code, v0, Cursor, Bolt).

## Statut

**Jalons 1 (le tuyau), 2 (abstraction + filtre) et 3 (relance sur rejet) validés en
conditions réelles.** Formulaire URL + description, route serverless qui scrape la
page (ou reçoit une capture en repli si le scraping échoue), appel au modèle, filtre
anti-littéral, affichage structuré.

**Jalon 3 — relance automatique.** Quand le filtre rejette une sortie, le serveur
redemande au modèle de corriger *uniquement* les passages fautifs, sans re-scraper la
page. Une seule relance, jamais deux. Si elle réussit, la réponse porte un champ
`corrige` et l'interface l'annonce ; si elle échoue, le rejet d'origine est affiché.
Voir `docs/superpowers/specs/2026-08-24-jalon-3-relance-422-design.md`.

**Modèle de coût : BYOK (bring your own key).** Chaque utilisateur saisit sa propre
clé API dans l'interface — OpenRouter par défaut, Anthropic disponible dans le menu.
Elle part directement au fournisseur à chaque requête, n'est jamais stockée ni
journalisée côté serveur, et disparaît au rechargement de la page. L'opérateur qui
héberge l'outil ne paie rien pour les visiteurs, et c'est le code qui le garantit :
hors développement, `/api/analyze` ignore toute clé présente dans l'environnement
(voir « `.env` » plus bas).

Le champ modèle est pré-rempli avec un modèle gratuit fonctionnel, pour qu'un
visiteur n'ait qu'à coller sa clé. Les slugs gratuits d'OpenRouter changent — celui
par défaut vit dans `src/constants.ts`, avec la commande pour lister ceux du moment.

## Setup

```bash
npm install
npm run dev:full
```

Ouvre l'app et colle ta clé directement dans le formulaire — pas de fichier `.env`
requis pour un usage normal. OpenRouter est présélectionné avec un modèle gratuit.

- `npm run dev` : Vite seul, sans `/api` — contrôle visuel rapide de l'interface
- `npm run dev:full` : pipeline complet (frontend + `/api/analyze`), sans nécessiter
  de compte Vercel — pratique pour le développement local
- `npm run dev:vercel` : `vercel dev` réel, une fois le projet lié (`vercel link`)

### `.env` — développeur uniquement

`.env.example` documente `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` +
`OPENROUTER_MODEL` comme repli optionnel côté serveur, utile seulement pour tester
en local sans re-saisir une clé à chaque redémarrage. Ce repli ne s'active que si le
champ clé du formulaire est vide **et** que `NODE_ENV !== 'production'`.

Le BYOK strict n'est donc plus une consigne de déploiement qu'on peut oublier, mais
une propriété du code : sur un déploiement, une variable d'environnement laissée là
par mégarde ne peut pas faire payer l'opérateur pour les requêtes des visiteurs.

## Structure

- `src/lib/systemPrompt.ts` — le prompt système d'abstraction (jalon 2)
- `src/lib/literalFilter.ts` — filtre de sortie qui rejette tout littéral résiduel
- `src/lib/repairPrompt.ts` — message de correction ciblée envoyé en relance (jalon 3)
- `src/lib/scrape.ts` — fetch natif + parseur HTML léger, sans dépendance lourde
- `src/lib/callModel.ts` — dispatch Anthropic / OpenRouter selon la clé fournie par le client
- `src/constants.ts` — modèle OpenRouter proposé par défaut
- `api/analyze.ts` — route serverless : scrape → modèle → filtre → relance → JSON
- `docs/superpowers/specs/` — décisions de conception, une par jalon

## Vérification

```bash
npm run check
```

25 vérifications sans dépendance de test ajoutée, sur le loader SSR de Vite déjà
présent : le filtre anti-littéral (dont trois tours consécutifs, un tour unique
masquerait une regex à état), la garantie BYOK, et les branches de relance avec un
appel modèle simulé. `npm run typecheck` complète.
