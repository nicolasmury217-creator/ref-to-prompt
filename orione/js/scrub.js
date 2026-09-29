/* ==========================================================================
   ORIONE — moteur de scroll-scrubbing
   --------------------------------------------------------------------------
   Le scroll est le seul contrôleur du temps : la séquence avance ET recule.
   - GSAP ScrollTrigger (scrub: 0.6) + Lenis pour l'inertie
   - Rendu dans une boucle requestAnimationFrame : pour une progression p,
     i = p × (FRAME_COUNT − 1) ; on dessine floor(i), puis la frame suivante
     par-dessus avec une opacité égale à la partie décimale de i.
   - Mémoire : toutes les frames restent en Blob compressé (≈ 80 Ko), mais
     seules celles proches de la position courante sont décodées en
     ImageBitmap (fenêtre glissante, fermées à l'éviction).
   - Repli : prefers-reduced-motion, connexion lente ou échec de chargement
     → 7 images fixes en fondu, une par chapitre.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- Configuration ---------- */
  const FRAME_COUNT   = 245;            // nombre de frames extraites (configurable)
  const PRELOAD_FIRST = 24;             // frames chargées avant d'afficher
  const BATCH_SIZE    = 6;              // taille des lots en arrière-plan
  const DPR_CAP       = 2;              // devicePixelRatio plafonné
  const MOBILE_QUERY  = '(max-width: 767px)';

  const DIR_DESKTOP = 'frames/';        // 1920 px de large
  const DIR_MOBILE  = 'frames-m/';      // 960 px de large
  const NATIVE_W    = { desktop: 1920, mobile: 960 };
  const NATIVE_RATIO = 1074 / 1920;     // hauteur / largeur d'une frame

  // Fenêtre de décodage autour de l'index courant (en frames)
  const DECODE_BEHIND = 6;
  const DECODE_AHEAD  = 10;
  const KEEP_BEHIND   = 12;
  const KEEP_AHEAD    = 22;
  const MAX_DECODING  = 3;              // décodages simultanés

  // Bornes des 7 chapitres (part de la progression 0 → 1)
  const CHAPTERS = [0, 0.12, 0.28, 0.45, 0.62, 0.78, 0.92, 1];
  const CHAPTER_COUNT = CHAPTERS.length - 1;

  /* ---------- Éléments ---------- */
  const root      = document.documentElement;
  const zone      = document.querySelector('.scrub');
  const canvas    = document.getElementById('canvas');
  const loader    = document.getElementById('loader');
  const loaderVal = document.getElementById('loader-value');
  const stills    = Array.from(document.querySelectorAll('#stills .still'));
  const gaugeNow  = document.getElementById('gauge-now');
  const gaugeFill = document.getElementById('gauge-fill');
  const debugEl   = document.getElementById('debug');
  const ctx       = canvas.getContext('2d', { alpha: false });

  const isMobile = () => window.matchMedia(MOBILE_QUERY).matches;

  /* ---------- Détection du mode de rendu ---------- */
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const conn = navigator.connection || {};
  const slowConnection = conn.saveData === true || /(^|-)2g$/.test(conn.effectiveType || '');
  const libsMissing = !(window.gsap && window.ScrollTrigger);
  let fallback = reducedMotion || slowConnection || libsMissing || !ctx;

  /* ---------- État ---------- */
  const blobs    = new Array(FRAME_COUNT).fill(null);   // frames compressées
  const bitmaps  = new Map();                           // index → ImageBitmap décodé
  const decoding = new Set();                           // index en cours de décodage
  let generation = 0;                                   // invalide les décodages d'avant un resize
  let cw = 0, ch = 0;                                   // taille du canvas en px physiques
  let decodeWidth = 0;                                  // largeur de décodage des bitmaps
  let progress = 0;                                     // progression lissée (scrub) → frames
  let rawProgress = 0;                                  // progression brute du scroll → chapitres
  let chapter = 0;
  let drawnKey = '';
  let dirty = true;
  let visible = true;
  let started = false;
  let rafId = 0;
  let lenis = null;
  let trigger = null;

  root.classList.add('is-loading');
  if (fallback) root.classList.add('is-fallback');

  /* ---------- Utilitaires ---------- */
  const frameURL = (i) =>
    (isMobile() ? DIR_MOBILE : DIR_DESKTOP) + 'f_' + String(i + 1).padStart(4, '0') + '.webp';

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function chapterAt(p) {
    for (let c = CHAPTER_COUNT - 1; c > 0; c--) if (p >= CHAPTERS[c]) return c;
    return 0;
  }

  /* ---------- Chargement ---------- */
  async function fetchFrame(i) {
    if (blobs[i]) return;
    const res = await fetch(frameURL(i));
    if (!res.ok) throw new Error('Frame ' + i + ' : HTTP ' + res.status);
    blobs[i] = await res.blob();
  }

  /** Précharge les premières frames en signalant l'avancement (0 → 1). */
  async function preloadFirst(onProgress) {
    let done = 0;
    const total = Math.min(PRELOAD_FIRST, FRAME_COUNT);
    await Promise.all(Array.from({ length: total }, (_, i) =>
      fetchFrame(i).then(() => onProgress(++done / total))));
  }

  /** Charge le reste en arrière-plan, par lots, une relance en cas d'échec. */
  async function preloadRest() {
    for (let start = PRELOAD_FIRST; start < FRAME_COUNT; start += BATCH_SIZE) {
      const batch = [];
      for (let i = start; i < Math.min(start + BATCH_SIZE, FRAME_COUNT); i++) {
        batch.push(fetchFrame(i).catch(() => fetchFrame(i).catch(() => {})));
      }
      await Promise.all(batch);
      // Laisse respirer le thread principal entre deux lots
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  /* ---------- Décodage à fenêtre glissante ---------- */
  function decodeFrame(i) {
    if (bitmaps.has(i) || decoding.has(i) || !blobs[i]) return;
    decoding.add(i);
    const gen = generation;
    createImageBitmap(blobs[i], { resizeWidth: decodeWidth, resizeQuality: 'medium' })
      .then((bmp) => {
        decoding.delete(i);
        const center = Math.round(progress * (FRAME_COUNT - 1));
        if (gen !== generation || i < center - KEEP_BEHIND || i > center + KEEP_AHEAD) {
          bmp.close();                 // périmé : on libère tout de suite
          return;
        }
        bitmaps.set(i, bmp);
        dirty = true;
      })
      .catch(() => decoding.delete(i));
  }

  /** Décode ce qui manque autour de la position, libère ce qui s'en éloigne. */
  function pumpDecoding() {
    const center = Math.round(progress * (FRAME_COUNT - 1));

    for (const [i, bmp] of bitmaps) {
      if (i < center - KEEP_BEHIND || i > center + KEEP_AHEAD) {
        bmp.close();
        bitmaps.delete(i);
      }
    }

    if (decoding.size >= MAX_DECODING) return;
    const lo = Math.max(0, center - DECODE_BEHIND);
    const hi = Math.min(FRAME_COUNT - 1, center + DECODE_AHEAD);
    const wanted = [];
    for (let i = lo; i <= hi; i++) {
      if (!bitmaps.has(i) && !decoding.has(i) && blobs[i]) wanted.push(i);
    }
    wanted.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    for (const i of wanted) {
      if (decoding.size >= MAX_DECODING) break;
      decodeFrame(i);
    }
  }

  function releaseBitmaps() {
    generation++;
    for (const bmp of bitmaps.values()) bmp.close();
    bitmaps.clear();
    decoding.clear();
  }

  /** Bitmap le plus proche de l'index demandé (repli si pas encore décodé). */
  function nearestBitmap(i) {
    if (bitmaps.has(i)) return bitmaps.get(i);
    for (let d = 1; d < FRAME_COUNT; d++) {
      if (bitmaps.has(i - d)) return bitmaps.get(i - d);
      if (bitmaps.has(i + d)) return bitmaps.get(i + d);
    }
    return null;
  }

  /* ---------- Dessin ---------- */
  function drawCover(bmp) {
    const s  = Math.max(cw / bmp.width, ch / bmp.height);  // équivalent object-fit: cover
    const dw = bmp.width * s;
    const dh = bmp.height * s;
    ctx.drawImage(bmp, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
  }

  function render() {
    const i = progress * (FRAME_COUNT - 1);
    const a = Math.floor(i);
    const frac = i - a;
    const b = Math.min(a + 1, FRAME_COUNT - 1);

    // Ne redessine que si la position (ou la taille) a changé
    const key = a + ':' + Math.round(frac * 200) + ':' + cw + 'x' + ch;
    if (!dirty && key === drawnKey) return;

    const A = nearestBitmap(a);
    if (!A) return;                                    // rien de décodé : on garde l'image précédente
    dirty = false;
    drawnKey = key;

    ctx.globalAlpha = 1;
    drawCover(A);

    // Fondu entre frames voisines : la suivante par-dessus, opacité = partie décimale
    if (b !== a && frac > 0.004) {
      const B = nearestBitmap(b);
      if (B && B !== A) {
        ctx.globalAlpha = frac;
        drawCover(B);
        ctx.globalAlpha = 1;
      }
    }
  }

  function tick() {
    rafId = requestAnimationFrame(tick);
    if (!visible) return;
    pumpDecoding();
    render();
    if (debugEl && !debugEl.hidden) updateDebug();
  }

  /* ---------- Taille du canvas ---------- */
  function sizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (w === cw && h === ch) return false;
    cw = canvas.width = w;
    ch = canvas.height = h;

    // Largeur de décodage : juste ce qu'il faut pour couvrir le canvas, sans agrandir
    const native = isMobile() ? NATIVE_W.mobile : NATIVE_W.desktop;
    decodeWidth = Math.min(native, Math.ceil(Math.max(cw, ch / NATIVE_RATIO)));
    return true;
  }

  let resizeTimer = 0;
  let lastW = window.innerWidth, lastH = window.innerHeight;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // Ignore les variations de hauteur dues à la barre d'adresse mobile
      const dW = Math.abs(window.innerWidth - lastW);
      const dH = Math.abs(window.innerHeight - lastH);
      if (dW < 2 && dH < 120) return;
      lastW = window.innerWidth; lastH = window.innerHeight;
      if (sizeCanvas()) { releaseBitmaps(); dirty = true; }
      window.ScrollTrigger && ScrollTrigger.refresh();
    }, 150);
  }

  /* ---------- Chapitres et jauge ---------- */
  function setChapter(c) {
    if (c === chapter && gaugeNow.textContent === String(c + 1).padStart(2, '0')) return;
    chapter = c;
    gaugeNow.textContent = String(c + 1).padStart(2, '0');
    stills.forEach((el, k) => el.classList.toggle('is-active', k === c));
    zone.dispatchEvent(new CustomEvent('orione:chapter', { detail: { chapter: c } }));
  }

  function onScrollProgress(self) {
    rawProgress = self.progress;
    gaugeFill.style.transform = 'scaleY(' + rawProgress.toFixed(4) + ')';
    setChapter(chapterAt(rawProgress));
    zone.dispatchEvent(new CustomEvent('orione:progress', { detail: { progress: rawProgress } }));
  }

  /* ---------- Debug (?debug) ---------- */
  function updateDebug() {
    const loaded = blobs.reduce((n, b) => n + (b ? 1 : 0), 0);
    debugEl.textContent =
      'p       ' + progress.toFixed(3) + '\n' +
      'frame   ' + (progress * (FRAME_COUNT - 1)).toFixed(2) + ' / ' + (FRAME_COUNT - 1) + '\n' +
      'chapitre ' + (chapter + 1) + ' / ' + CHAPTER_COUNT + '\n' +
      'chargées ' + loaded + ' / ' + FRAME_COUNT + '\n' +
      'décodées ' + bitmaps.size + '\n' +
      'canvas  ' + cw + '×' + ch + ' (dpr ' + Math.min(devicePixelRatio, DPR_CAP) + ')';
  }

  /* ---------- Moteur de scroll ---------- */
  function startScroll() {
    if (libsMissing) {
      // Bibliothèques indisponibles : suivi natif du scroll, images fixes seulement
      const follow = () => {
        const r = zone.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        onScrollProgress({ progress: clamp(-r.top / span, 0, 1) });
      };
      window.addEventListener('scroll', follow, { passive: true });
      follow();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    if (!fallback && window.Lenis) {
      lenis = new Lenis({ duration: 1.15, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis && lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }

    if (fallback) {
      // Pas de scrub : un simple suivi de la progression pour changer d'image
      trigger = ScrollTrigger.create({
        trigger: zone, start: 'top top', end: 'bottom bottom',
        onUpdate: onScrollProgress,
      });
    } else {
      // Le scroll pilote un proxy lissé (scrub: 0.6) ; la boucle rAF le lit
      const proxy = { p: 0 };
      const tween = gsap.to(proxy, {
        p: 1, ease: 'none',
        onUpdate: () => { progress = proxy.p; },
        scrollTrigger: {
          trigger: zone, start: 'top top', end: 'bottom bottom',
          scrub: 0.6,
          onUpdate: onScrollProgress,
        },
      });
      trigger = tween.scrollTrigger;
    }
    onScrollProgress({ progress: trigger ? trigger.progress : 0 });
  }

  function reveal() {
    loader.classList.add('is-done');
    root.classList.remove('is-loading');
    root.classList.add('is-ready');                  // les textes du chapitre 1 peuvent apparaître
    document.dispatchEvent(new CustomEvent('orione:ready'));
    if (lenis) lenis.start();
  }

  function setLoaderValue(ratio) {
    loaderVal.textContent = Math.round(clamp(ratio, 0, 1) * 100);
  }

  /* ---------- Démarrage ---------- */
  async function init() {
    if (debugEl && /[?&]debug\b/.test(location.search)) debugEl.hidden = false;

    if (fallback) {                                  // images fixes : pas de préchargement
      startScroll();
      reveal();
      return;
    }

    sizeCanvas();
    try {
      await preloadFirst(setLoaderValue);            // 1) les 24 premières frames
      // Décode le début de la séquence avant d'afficher (au moins la 1re frame)
      const first = [];
      for (let i = 0; i <= DECODE_AHEAD; i++) {
        first.push(createImageBitmap(blobs[i], { resizeWidth: decodeWidth, resizeQuality: 'medium' })
          .then((bmp) => bitmaps.set(i, bmp)));
      }
      await Promise.all(first);
    } catch (err) {                                  // échec : on bascule sur les images fixes
      console.warn('[orione] chargement impossible, repli sur les images fixes', err);
      releaseBitmaps();
      fallback = true;
      root.classList.add('is-fallback');
      startScroll();
      reveal();
      return;
    }

    startScroll();
    if (lenis) lenis.stop();
    setLoaderValue(1);
    render();
    started = true;
    rafId = requestAnimationFrame(tick);
    setTimeout(reveal, 250);                         // laisse « 100 » lisible un instant

    preloadRest();                                   // 2) le reste, en arrière-plan

    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) dirty = true;
    }, { rootMargin: '50% 0px' }).observe(zone);

    window.addEventListener('resize', onResize, { passive: true });
  }

  /* ---------- Nettoyage (aucune fuite mémoire) ---------- */
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(rafId);
    clearTimeout(resizeTimer);
    releaseBitmaps();
    if (trigger) trigger.kill();
    if (lenis) { lenis.destroy(); lenis = null; }
  });

  // Exposé pour les étapes suivantes (textes des chapitres) et pour les tests
  window.ORIONE = {
    FRAME_COUNT,
    CHAPTERS,
    get progress() { return rawProgress; },
    get chapter() { return chapter; },
    get mode() { return fallback ? 'fallback' : 'canvas'; },
    get started() { return started; },
    get lenis() { return lenis; },
    stats: () => ({ decoded: bitmaps.size, decoding: decoding.size, loaded: blobs.filter(Boolean).length }),
  };

  init();
})();
