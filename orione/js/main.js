/* ==========================================================================
   ORIONE — interface : chapitres, header, menu, sections, curseur, formulaire
   Le moteur de scroll-scrubbing vit dans scrub.js (window.ORIONE).
   ========================================================================== */
(() => {
  'use strict';

  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const engine = () => window.ORIONE || {};
  const lenis = () => engine().lenis || null;

  /* ------------------------------------------------------------------------
     1. Chapitres : apparition ligne par ligne, disparition douce
     ------------------------------------------------------------------------ */
  const zone = $('.scrub');
  const chapters = $$('.chapter');
  const BOUNDS = engine().CHAPTERS || [0, 0.12, 0.28, 0.45, 0.62, 0.78, 0.92, 1];
  const FADE_IN_AFTER = 0.008;    // le texte n'entre qu'un peu après le début du chapitre
  const FADE_OUT_BEFORE = 0.022;  // et sort avant le chapitre suivant : jamais deux textes à la fois

  // Décalage en cascade des lignes de chaque chapitre (variable CSS --i)
  chapters.forEach((chapter) => {
    $$('.line', chapter).forEach((line, i) => line.style.setProperty('--i', i));
  });

  function updateChapters(p) {
    const last = chapters.length - 1;
    chapters.forEach((chapter, c) => {
      const start = c === 0 ? -1 : BOUNDS[c] + FADE_IN_AFTER;
      const end = c === last ? 2 : BOUNDS[c + 1] - FADE_OUT_BEFORE;
      chapter.classList.toggle('is-in', p >= start && p <= end);
    });
  }

  zone.addEventListener('orione:progress', (e) => updateChapters(e.detail.progress));
  updateChapters(engine().progress || 0);

  /* ------------------------------------------------------------------------
     2. Défilement vers une ancre (Lenis si présent)
     ------------------------------------------------------------------------ */
  function scrollToTarget(target) {
    const l = lenis();
    if (l) {
      l.scrollTo(target === 'top' ? 0 : target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    } else if (target === 'top') {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    } else {
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    }
  }

  const LENGTH_FOR_MODEL = { 24: '18-24', 38: '24-38', 55: '38-55' };

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const el = id === 'top' ? null : document.getElementById(id);
    if (id !== 'top' && !el) return;
    e.preventDefault();

    // Un modèle prérempli la longueur souhaitée du formulaire
    if (a.dataset.length) $('#f-longueur').value = LENGTH_FOR_MODEL[a.dataset.length] || '';

    closeMenu(false);
    scrollToTarget(id === 'top' ? 'top' : el);
  });

  /* ------------------------------------------------------------------------
     3. Header : masqué au scroll vers le bas, réaffiché vers le haut
     ------------------------------------------------------------------------ */
  const header = $('#header');
  let lastY = window.scrollY;
  let menuOpen = false;

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    const dy = y - lastY;
    if (Math.abs(dy) < 6) return;
    if (menuOpen || y < 80 || dy < 0) header.classList.remove('is-hidden');
    else header.classList.add('is-hidden');
    lastY = y;
  }, { passive: true });

  /* ------------------------------------------------------------------------
     4. Menu plein écran (clavier : Échap ferme, Tab reste dans le menu)
     ------------------------------------------------------------------------ */
  const menu = $('#menu');
  const menuBtn = $('#menu-btn');

  function openMenu() {
    menuOpen = true;
    menu.classList.add('is-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    menuBtn.textContent = 'Fermer';
    header.classList.remove('is-hidden');
    root.style.overflow = 'hidden';
    if (lenis()) lenis().stop();
    const first = $('a', menu);
    if (first) setTimeout(() => first.focus({ preventScroll: true }), 50);
  }

  function closeMenu(restoreFocus = true) {
    if (!menuOpen) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    menuBtn.textContent = 'Menu';
    root.style.overflow = '';
    if (lenis()) lenis().start();
    if (restoreFocus) menuBtn.focus({ preventScroll: true });
  }

  menuBtn.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));

  document.addEventListener('keydown', (e) => {
    if (!menuOpen) return;
    if (e.key === 'Escape') { closeMenu(); return; }
    if (e.key !== 'Tab') return;
    const items = [$('.header__logo'), menuBtn, $('.header__link--cta'), ...$$('a', menu)];
    const first = items[0];
    const lastItem = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastItem.focus(); }
    else if (!e.shiftKey && document.activeElement === lastItem) { e.preventDefault(); first.focus(); }
  });

  /* ------------------------------------------------------------------------
     5. Manifeste : le paragraphe se révèle mot par mot au scroll
     ------------------------------------------------------------------------ */
  const manifesto = $('#manifesto-text');
  if (manifesto && hasGsap && !reduced) {
    const words = manifesto.textContent.trim().split(/\s+/);
    manifesto.textContent = '';
    const spans = words.map((word, i) => {
      const span = document.createElement('span');
      span.className = 'w';
      span.textContent = word;
      manifesto.append(span, i < words.length - 1 ? ' ' : '');
      return span;
    });
    gsap.fromTo(spans, { opacity: 0.16 }, {
      opacity: 1,
      ease: 'none',
      stagger: 0.12,
      scrollTrigger: { trigger: manifesto, start: 'top 82%', end: 'bottom 55%', scrub: 0.6 },
    });
  }

  /* ------------------------------------------------------------------------
     6. Chiffres : trois compteurs animés
     ------------------------------------------------------------------------ */
  const nf = new Intl.NumberFormat('fr-FR');
  $$('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    if (!hasGsap || reduced) { el.textContent = nf.format(target); return; }
    const counter = { v: 0 };
    el.textContent = '0';
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(counter, {
        v: target,
        duration: 1.8,
        ease: 'power3.out',
        onUpdate: () => { el.textContent = nf.format(Math.round(counter.v)); },
        onComplete: () => { el.textContent = nf.format(target); },
      }),
    });
  });

  /* ------------------------------------------------------------------------
     7. Curseur personnalisé : cercle fin, désactivé sur mobile et au tactile
     ------------------------------------------------------------------------ */
  const cursor = $('#cursor');
  const fine = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)');
  if (cursor && fine.matches) {
    root.classList.add('has-cursor');
    let x = -100, y = -100, cx = x, cy = y, raf = 0;

    const loop = () => {
      cx += (x - cx) * 0.2;
      cy += (y - cy) * 0.2;
      cursor.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', (e) => {
      x = e.clientX; y = e.clientY;
      if (!cursor.classList.contains('is-active')) { cx = x; cy = y; }
      cursor.classList.add('is-active');
      if (!raf) raf = requestAnimationFrame(loop);
      const t = e.target;
      cursor.classList.toggle('is-hover', !!t.closest('a, button, summary, select, [data-cursor]'));
      cursor.classList.toggle('is-text', !!t.closest('input, textarea'));
    }, { passive: true });

    document.addEventListener('mouseleave', () => cursor.classList.remove('is-active'));
    document.addEventListener('mouseenter', () => cursor.classList.add('is-active'));
    window.addEventListener('pagehide', () => cancelAnimationFrame(raf));
  }

  /* ------------------------------------------------------------------------
     8. Formulaire : validation accessible
        Aucun serveur n'est branché : si data-endpoint est renseigné sur le
        <form>, la demande y est envoyée en JSON ; sinon la messagerie de
        l'utilisateur s'ouvre avec le message prérempli (data-mailto).
     ------------------------------------------------------------------------ */
  const form = $('#form');
  const status = $('#form-status');
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function setError(input, message) {
    const err = $('#e-' + input.name);
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    if (message) input.setAttribute('aria-describedby', err.id); else input.removeAttribute('aria-describedby');
    err.textContent = message;
    return !message;
  }

  function validate() {
    const nom = form.elements.nom;
    const email = form.elements.email;
    const okNom = setError(nom, nom.value.trim() ? '' : 'Indiquez votre nom.');
    const okMail = setError(email, EMAIL_RE.test(email.value.trim()) ? '' : 'Indiquez une adresse email valide.');
    if (!okNom) { nom.focus(); return false; }
    if (!okMail) { email.focus(); return false; }
    return true;
  }

  form.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true') validate();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.textContent = '';
    if (!validate()) return;

    const data = Object.fromEntries(new FormData(form).entries());
    const endpoint = form.dataset.endpoint;

    if (endpoint) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        form.reset();
        status.textContent = 'Merci. Nous revenons vers vous très vite.';
      } catch (err) {
        status.textContent = 'L\'envoi a échoué. Réessayez ou écrivez-nous directement.';
      }
      return;
    }

    const body = [
      'Nom : ' + data.nom,
      'Email : ' + data.email,
      'Longueur souhaitée : ' + (data.longueur || 'à définir'),
      '',
      data.message || '',
    ].join('\n');
    window.location.href = 'mailto:' + form.dataset.mailto +
      '?subject=' + encodeURIComponent('Demande de rendez-vous privé') +
      '&body=' + encodeURIComponent(body);
    status.textContent = 'Votre messagerie s\'ouvre pour envoyer la demande.';
  });

  /* ------------------------------------------------------------------------
     9. Recalcul des positions une fois les polices chargées
     ------------------------------------------------------------------------ */
  if (hasGsap && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh());
  }
})();
