// Scrape simulé, substitué à `src/lib/scrape` le temps des vérifications.
// Fournit un domaine et des polices sources afin que le filtre anti-littéral ait
// réellement de quoi mordre, sans aller chercher une page sur le réseau.

export async function scrapePage() {
  return {
    html: '<main>page de reference</main>',
    css: 'body { font-family: Söhne, sans-serif }',
    fonts: ['Söhne'],
    domain: 'linear.app',
    title: 'Page de reference',
  };
}
