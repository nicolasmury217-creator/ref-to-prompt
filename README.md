# référence → prompt de design

Colle l'URL d'un site que tu aimes, décris ce que tu veux construire. L'outil génère
un prompt de création de site — abstrait, jamais littéral — à coller dans un agent de
code (Claude Code, v0, Cursor, Bolt).

## Statut

**Jalon 1 (le tuyau) + jalon 2 (abstraction + filtre) validés en conditions réelles.**
Formulaire URL + description, route serverless qui scrape la page (ou reçoit une
capture en repli si le scraping échoue), appel au modèle, affichage JSON brut. Le
prompt système d'abstraction (`src/lib/systemPrompt.ts`) et le filtre anti-littéral
(`src/lib/literalFilter.ts`) sont intégrés dans `/api/analyze` et testés bout-en-bout.

**Modèle de coût : BYOK (bring your own key).** Chaque utilisateur saisit sa propre
clé API (Anthropic ou OpenRouter) dans l'interface. Elle part directement au
fournisseur à chaque requête, n'est jamais stockée ni journalisée côté serveur, et
disparaît au rechargement de la page. L'opérateur qui héberge l'outil ne paie rien
pour les visiteurs.

## Setup

```bash
npm install
npm run dev:full
```

Ouvre l'app, choisis un fournisseur (Anthropic ou OpenRouter) et colle ta clé
directement dans le formulaire — pas de fichier `.env` requis pour un usage normal.

- `npm run dev` : Vite seul, sans `/api` — contrôle visuel rapide de l'interface
- `npm run dev:full` : pipeline complet (frontend + `/api/analyze`), sans nécessiter
  de compte Vercel — pratique pour le développement local
- `npm run dev:vercel` : `vercel dev` réel, une fois le projet lié (`vercel link`)

### `.env` — développeur uniquement

`.env.example` documente `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` +
`OPENROUTER_MODEL` comme repli optionnel côté serveur, utile seulement pour tester
en local sans re-saisir une clé dans l'UI à chaque redémarrage. Ce repli ne s'active
que si le champ clé du formulaire est vide ; en production, ne définis pas ces
variables si tu veux garder le modèle BYOK strict.

## Structure

- `src/lib/systemPrompt.ts` — le prompt système d'abstraction (jalon 2)
- `src/lib/literalFilter.ts` — filtre de sortie qui rejette tout littéral résiduel
- `src/lib/scrape.ts` — fetch natif + parseur HTML léger, sans dépendance lourde
- `src/lib/callModel.ts` — dispatch Anthropic / OpenRouter selon la clé fournie par le client
- `api/analyze.ts` — route serverless : scrape → modèle → filtre → JSON
