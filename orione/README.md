# Orione — site one-page

Site statique (HTML, CSS, JS) : aucune étape de build. Servir le dossier tel quel
(`python3 -m http.server`, Vercel, Netlify, etc.).

- `index.html`, `css/style.css`, `js/scrub.js` (moteur de scroll), `js/main.js` (interface)
- `frames/` (1920 px) et `frames-m/` (960 px, mobile) : 245 frames WebP de la séquence
- `stills/` : 7 images fixes (repli `prefers-reduced-motion`, connexion lente)
- `images/` : les trois modèles ; `fonts/` : Cormorant Garamond et Inter (SIL OFL) ; `vendor/` : GSAP, ScrollTrigger, Lenis
- `scripts/build-frames.sh` : régénère les frames depuis `work/clip1.mp4` … `clip7.mp4` (non versionnés)

## Nombre de frames

`FRAME_COUNT` est en tête de `js/scrub.js` (245). S'il change, régénérer les frames avec
`scripts/build-frames.sh` (même constante) et garder les deux valeurs identiques.

## À renseigner avant la mise en ligne

- `data-endpoint` sur le `<form>` (URL d'envoi JSON) ; sans elle, le formulaire ouvre la messagerie vers `data-mailto` (adresse factice)
- `og:image` en URL absolue, une fois le domaine connu
- Mentions légales (raison sociale, hébergeur) dans le footer
- Les caractéristiques des modèles (cabines, vitesses) sont fictives

## Déploiement sur Vercel

Le dépôt contient aussi une autre application (Vite, `vercel.json` à la racine) : Orione doit donc être
un **projet Vercel distinct**, dont le dossier racine est `orione/`.

1. Vercel → *Add New… → Project* → importer ce dépôt GitHub.
2. *Root Directory* : `orione`. *Framework Preset* : **Other**. Laisser vides *Build Command* et *Output Directory*
   (`orione/vercel.json` les fixe : aucun build, dossier servi tel quel).
3. *Deploy*. Chaque push sur une branche crée un déploiement de prévisualisation ; la production suit la
   branche de production du projet (par défaut la branche principale : fusionner d'abord la branche de travail).

En ligne de commande : `cd orione && npx vercel` (prévisualisation) puis `npx vercel --prod`.

`orione/vercel.json` configure :
- le cache : polices 1 an (immuables), frames / images / stills 7 jours, CSS et JS 1 jour, page toujours revalidée ;
- les en-têtes de sécurité : CSP stricte (tout en `'self'`), `nosniff`, Referrer-Policy, Permissions-Policy, `frame-ancestors 'none'`.

**Si vous branchez un service d'envoi pour le formulaire** (`data-endpoint`), ajouter son domaine à
`connect-src` dans la CSP, sinon le navigateur bloquera la requête.

Après le premier déploiement : remplacer `og:image` par l'URL absolue (`https://<domaine>/og.jpg`) dans `index.html`.
Les frames gardent des noms fixes : si elles sont régénérées, attendre l'expiration du cache (7 jours)
ou renommer le dossier.
