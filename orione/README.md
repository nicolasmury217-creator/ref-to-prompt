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
