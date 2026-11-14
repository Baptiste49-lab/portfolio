/* ==========================================================================
   Traduction du site (FR par défaut, EN et ES en option)
   - Le français est écrit directement dans index.html.
   - data-t="clé"            : le contenu de l'élément est remplacé par la traduction.
   - data-ta="attribut:clé"  : traduit un attribut (aria-label, alt, data-cursor…),
                               plusieurs paires séparées par « ; ».
   - Les traductions sont dans js/lang-en.js (window.LANG_EN) et js/lang-es.js (window.LANG_ES).
   - La langue vient de ?lang=xx dans l'adresse, sinon du dernier choix du visiteur.
   Ce script tourne avant js/main.js, qui découpe ensuite les titres pour les animations.
   ========================================================================== */
(() => {
  'use strict';

  const SUPPORTED = ['fr', 'en', 'es'];
  const DICTS = { en: window.LANG_EN || null, es: window.LANG_ES || null };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* stockage indisponible : tant pis */ } }
  };

  const fromUrl = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
  let lang = SUPPORTED.includes(fromUrl) ? fromUrl : (store.get('lang') || 'fr').toLowerCase();
  if (!SUPPORTED.includes(lang)) lang = 'fr';
  if (SUPPORTED.includes(fromUrl)) store.set('lang', fromUrl);

  const dict = DICTS[lang];
  const has = key => !!dict && Object.prototype.hasOwnProperty.call(dict, key);
  const t = (key, fallback) => (has(key) ? dict[key] : fallback);

  window.I18N = { lang, t };
  document.documentElement.lang = lang;

  if (dict) {
    document.querySelectorAll('[data-t]').forEach(el => {
      const key = el.getAttribute('data-t');
      if (!has(key)) return;
      if (el instanceof SVGElement) el.textContent = dict[key];
      else el.innerHTML = dict[key];
    });
    document.querySelectorAll('[data-ta]').forEach(el => {
      el.getAttribute('data-ta').split(';').forEach(pair => {
        const i = pair.indexOf(':');
        if (i < 1) return;
        const attr = pair.slice(0, i).trim();
        const key = pair.slice(i + 1).trim();
        if (has(key)) el.setAttribute(attr, dict[key]);
      });
    });
    if (has('meta.title')) document.title = dict['meta.title'];
    const desc = document.querySelector('meta[name="description"]');
    if (desc && has('meta.desc')) desc.setAttribute('content', dict['meta.desc']);
  }

  /* Sélecteur de langue : recharge la page dans la langue choisie, au même endroit. */
  document.querySelectorAll('[data-lang]').forEach(a => {
    const code = a.getAttribute('data-lang');
    const url = new URL(location.href);
    url.hash = '';
    if (code === 'fr') url.searchParams.delete('lang'); else url.searchParams.set('lang', code);
    a.setAttribute('href', url.pathname + url.search);
    if (code === lang) a.setAttribute('aria-current', 'true');
    a.addEventListener('click', e => {
      e.preventDefault();
      if (code === lang) return;
      store.set('lang', code);
      try {
        sessionStorage.setItem('quickIntro', '1');
        sessionStorage.setItem('restoreY', String(Math.round(window.scrollY)));
      } catch (err) { /* rien à faire */ }
      location.href = a.getAttribute('href');
    });
  });
})();
