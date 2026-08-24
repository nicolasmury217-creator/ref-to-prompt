// Vérifications du projet, sans dépendance de test ajoutée : les modules TypeScript
// sont chargés par le loader SSR de Vite, déjà présent.
//
//   npm run check
//
// Couvre le filtre anti-littéral, la garantie BYOK, et les branches de relance de
// /api/analyze avec un appel modèle simulé.

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ICI = dirname(fileURLToPath(import.meta.url));
const RACINE = resolve(ICI, '../..');
const { createServer } = await import(`${RACINE}/node_modules/vite/dist/node/index.js`);

let echecs = 0;
let total = 0;

function verifie(intitule, condition, detail) {
  total++;
  if (!condition) echecs++;
  const marque = condition ? 'ok  ' : 'ÉCHEC';
  console.log(`  ${marque}  ${intitule}${!condition && detail ? `\n         → ${detail}` : ''}`);
}

function titre(texte) {
  console.log(`\n${texte}`);
}

/** Substitue des modules par leur doublure, par suffixe de chemin d'import. */
function doublures(table) {
  return {
    name: 'doublures-verification',
    // 'pre' est indispensable : sans lui le résolveur interne de Vite traite
    // l'import relatif en premier et court-circuite ce crochet.
    enforce: 'pre',
    resolveId(source) {
      for (const [suffixe, remplacement] of Object.entries(table)) {
        if (source.endsWith(suffixe)) return remplacement;
      }
      return null;
    },
  };
}

// ---------------------------------------------------------------- filtre

async function verifieFiltre(vite) {
  titre('Filtre anti-littéral');
  const { filterLiterals } = await vite.ssrLoadModule('/src/lib/literalFilter.ts');
  const sortie = (prompt) => ({ grammaire: [], preferences: [], tensions: [], prompt });
  const REJET = true;
  const PASSE = false;

  const cas = [
    ['rgb() littéral', sortie('un fond en rgb(10, 10, 10)'), { fonts: [], domain: 'x.com' }, REJET],
    ['hsl() littéral', sortie('un accent hsl(12, 80%, 55%)'), { fonts: [], domain: 'x.com' }, REJET],
    ['hex littéral', sortie('accent #E4572E'), { fonts: [], domain: 'x.com' }, REJET],
    ['police source citée', sortie('titres en Söhne'), { fonts: ['Söhne'], domain: 'x.com' }, REJET],
    ['marque citée', sortie('la discipline de Linear'), { fonts: [], domain: 'linear.app' }, REJET],
    ['marque en fin de phrase', sortie('la grammaire de Stripe.'), { fonts: [], domain: 'stripe.com' }, REJET],
    ['« micro-interactions » / Inter', sortie('Soigne les micro-interactions.'), { fonts: ['Inter'], domain: 'x.com' }, PASSE],
    ['« interface » / Inter', sortie('Une interface sobre.'), { fonts: ['Inter'], domain: 'x.com' }, PASSE],
    ['« intérieur » / Inter', sortie('Un rythme intérieur régulier.'), { fonts: ['Inter'], domain: 'x.com' }, PASSE],
    ['« des stripes » / stripe.com', sortie('Des stripes fines.'), { fonts: [], domain: 'stripe.com' }, PASSE],
    ['« sometimes » / Times', sortie('Sometimes la retenue vaut mieux.'), { fonts: ['Times'], domain: 'x.com' }, PASSE],
    ['sortie propre', sortie('un accent chaud sur un fond neutre'), { fonts: ['Söhne'], domain: 'linear.app' }, PASSE],
  ];

  // Trois tours : une regex à état ne déraille qu'aux appels répétés.
  for (let tour = 1; tour <= 3; tour++) {
    for (const [nom, resultat, ctx, attenduRejet] of cas) {
      const rejete = filterLiterals(resultat, ctx) !== null;
      if (tour === 1 || rejete !== attenduRejet) {
        verifie(
          tour === 1 ? nom : `${nom} (tour ${tour})`,
          rejete === attenduRejet,
          `obtenu ${rejete ? 'rejeté' : 'accepté'}, attendu ${attenduRejet ? 'rejeté' : 'accepté'}`
        );
      }
    }
  }
}

// ------------------------------------------------------------------ BYOK

async function verifieByok() {
  titre('Garantie BYOK');
  process.env.OPENROUTER_API_KEY = 'sk-or-FAUSSE-CLE-OPERATEUR';
  process.env.OPENROUTER_MODEL = 'un/modele:free';

  const vite = await createServer({ root: RACINE, server: { middlewareMode: true }, appType: 'custom' });
  const { default: handler } = await vite.ssrLoadModule('/api/analyze.ts');

  // URL injoignable : le scrape échoue vite, ce qui prouve qu'on a dépassé le
  // contrôle de clé sans dépenser d'appel modèle.
  const appelle = async () => {
    const req = { method: 'POST', body: { url: 'http://127.0.0.1:9/', description: 'test', provider: 'openrouter' } };
    let statut = 200;
    let charge;
    await handler(req, { status(c) { statut = c; return this; }, json(d) { charge = d; } });
    return { statut, charge };
  };

  process.env.NODE_ENV = 'production';
  const prod = await appelle();
  verifie(
    'production : la clé opérateur est refusée',
    prod.statut === 400 && prod.charge?.error === 'Clé API manquante',
    `HTTP ${prod.statut} ${JSON.stringify(prod.charge)}`
  );

  process.env.NODE_ENV = 'development';
  const dev = await appelle();
  verifie(
    'développement : le repli .env fonctionne encore',
    dev.statut === 200 && dev.charge?.scrapeFailed === true,
    `HTTP ${dev.statut} ${JSON.stringify(dev.charge)}`
  );

  await vite.close();
}

// --------------------------------------------------------------- relance

const SORTIE_PROPRE = {
  grammaire: [{ axe: 'Contraste', principe: 'un accent chaud sur un fond neutre sombre' }],
  preferences: [{ axe: 'Registre', demande: 'chaleur artisanale' }],
  tensions: [{ constat: 'froideur systémique', arbitrage: 'inverser la luminance' }],
  prompt: 'Construire un site chaleureux, grille ancrée à gauche, accent rare.',
};

const SORTIE_FUITEE = {
  ...SORTIE_PROPRE,
  prompt: 'Reprend la discipline structurelle de Linear, mais en plus chaleureux.',
};

async function verifieRelance() {
  titre('Relance sur rejet du filtre');
  process.env.NODE_ENV = 'development';

  const vite = await createServer({
    root: RACINE,
    server: { middlewareMode: true },
    appType: 'custom',
    plugins: [
      doublures({
        '/lib/callModel': resolve(ICI, 'stubs/callModel.mjs'),
        '/lib/scrape': resolve(ICI, 'stubs/scrape.mjs'),
      }),
    ],
  });
  const { default: handler } = await vite.ssrLoadModule('/api/analyze.ts');

  const appelle = async (reponses) => {
    globalThis.__REPONSES__ = reponses;
    globalThis.__APPELS__ = [];
    const req = {
      method: 'POST',
      body: { url: 'https://linear.app', description: 'un torréfacteur', provider: 'openrouter', apiKey: 'sk-or-test', openRouterModel: 'un/modele:free' },
    };
    let statut = 200;
    let charge;
    await handler(req, { status(c) { statut = c; return this; }, json(d) { charge = d; } });
    return { statut, charge, appels: globalThis.__APPELS__ };
  };

  const json = (o) => ({ texte: JSON.stringify(o) });

  const direct = await appelle([json(SORTIE_PROPRE)]);
  verifie(
    'sortie propre du premier coup : 200, aucune relance',
    direct.statut === 200 && direct.appels.length === 1 && direct.charge?.corrige === undefined,
    `HTTP ${direct.statut}, ${direct.appels.length} appel(s), corrige=${JSON.stringify(direct.charge?.corrige)}`
  );

  const repare = await appelle([json(SORTIE_FUITEE), json(SORTIE_PROPRE)]);
  verifie(
    'fuite puis correction : 200 avec la trace de la relance',
    repare.statut === 200 &&
      repare.appels.length === 2 &&
      repare.appels[1].reparation === true &&
      Array.isArray(repare.charge?.corrige?.motifs) &&
      repare.charge.corrige.motifs.some((m) => m.includes('linear')),
    `HTTP ${repare.statut}, ${repare.appels.length} appel(s), corrige=${JSON.stringify(repare.charge?.corrige)}`
  );

  verifie(
    'la relance reçoit le JSON rejeté et les motifs',
    repare.appels[1]?.repair?.rejectedJson?.includes('Linear') &&
      repare.appels[1]?.repair?.reasons?.length > 0,
    JSON.stringify(repare.appels[1]?.repair)
  );

  verifie(
    'le contenu corrigé est bien celui de la seconde tentative',
    repare.charge?.prompt === SORTIE_PROPRE.prompt,
    `prompt=${repare.charge?.prompt}`
  );

  const deuxRejets = await appelle([json(SORTIE_FUITEE), json(SORTIE_FUITEE)]);
  verifie(
    'les deux tentatives fuient : 422 avec les motifs',
    deuxRejets.statut === 422 && Array.isArray(deuxRejets.charge?.reasons) && deuxRejets.charge.reasons.length > 0,
    `HTTP ${deuxRejets.statut} ${JSON.stringify(deuxRejets.charge)}`
  );

  // « désolé, je ne peux pas » est de la prose, mais jsonrepair en tire un tableau
  // JSON valide. Sans contrôle de forme, cette bouillie franchissait le filtre et
  // repartait en 200.
  const relanceIllisible = await appelle([json(SORTIE_FUITEE), { texte: 'désolé, je ne peux pas' }]);
  verifie(
    'relance en prose : 422 avec le rejet d\'origine, pas une bouillie en 200',
    relanceIllisible.statut === 422 && relanceIllisible.charge?.error?.includes('littéral'),
    `HTTP ${relanceIllisible.statut} ${JSON.stringify(relanceIllisible.charge)}`
  );

  const premiereProse = await appelle([{ texte: 'je ne peux pas, désolé' }]);
  verifie(
    'première tentative en prose : 502, jamais un objet malformé',
    premiereProse.statut === 502 && premiereProse.charge?.error?.includes('non-JSON'),
    `HTTP ${premiereProse.statut} ${JSON.stringify(premiereProse.charge)}`
  );

  const champManquant = await appelle([json({ grammaire: [], preferences: [], tensions: [] })]);
  verifie(
    'JSON valide mais champ « prompt » absent : refusé',
    champManquant.statut === 502,
    `HTTP ${champManquant.statut} ${JSON.stringify(champManquant.charge)}`
  );

  const relanceEnPanne = await appelle([json(SORTIE_FUITEE), { erreur: 'réseau coupé' }]);
  verifie(
    'relance en erreur réseau : 422 avec le rejet d\'origine',
    relanceEnPanne.statut === 422 && relanceEnPanne.charge?.error?.includes('littéral'),
    `HTTP ${relanceEnPanne.statut} ${JSON.stringify(relanceEnPanne.charge)}`
  );

  verifie(
    'jamais plus d\'une relance',
    deuxRejets.appels.length === 2,
    `${deuxRejets.appels.length} appel(s)`
  );

  // Le piège central de la spec : les motifs citent le littéral interdit. Si on les
  // attachait avant le filtrage, une sortie pourtant corrigée serait rejetée par sa
  // propre explication.
  verifie(
    'pas d\'auto-rejet : la trace cite « linear » et la réponse sort quand même en 200',
    repare.statut === 200 && JSON.stringify(repare.charge).toLowerCase().includes('linear'),
    `HTTP ${repare.statut}`
  );

  await vite.close();
}

// ------------------------------------------------------------------- run

const viteFiltre = await createServer({ root: RACINE, server: { middlewareMode: true }, appType: 'custom' });
await verifieFiltre(viteFiltre);
await viteFiltre.close();

await verifieByok();
await verifieRelance();

console.log(
  echecs
    ? `\n${echecs} échec(s) sur ${total} vérifications.`
    : `\n${total} vérifications, toutes conformes.`
);
process.exit(echecs ? 1 : 0);
