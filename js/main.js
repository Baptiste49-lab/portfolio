/* ==========================================================================
   Portfolio — Baptiste Gautreau · animations et interactions (sans dépendance)
   ========================================================================== */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const root = document.documentElement;
  const body = document.body;

  /* ---------- Découpage du texte (mots / lettres) ---------- */
  function splitWords(el, cls = 'w', innerCls = 'wi') {
    let i = 0;
    const walk = node => {
      [...node.childNodes].forEach(n => {
        if (n.nodeType === 3) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/([ \n\t]+)/).forEach(part => {
            if (!part) return;
            if (/^[ \n\t]+$/.test(part)) { frag.append(' '); return; }
            const w = document.createElement('span'); w.className = cls;
            if (innerCls) {
              const inner = document.createElement('span'); inner.className = innerCls;
              inner.style.setProperty('--i', i++); inner.textContent = part; w.append(inner);
            } else { w.style.setProperty('--i', i++); w.textContent = part; }
            frag.append(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && n.tagName !== 'BR') walk(n);
      });
    };
    walk(el);
    return i;
  }

  $$('[data-words]').forEach(el => splitWords(el));
  $$('[data-chars]').forEach(el => {
    const text = el.textContent; el.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span'); s.className = 'char'; s.style.setProperty('--i', i);
      s.textContent = ch; el.append(s);
    });
  });
  $$('[data-reveal][data-delay]').forEach(el => el.style.setProperty('--d', el.dataset.delay));

  /* ---------- Écran d'ouverture ---------- */
  const loaderNum = $('.loader__num');
  const loaderBar = $('.loader__bar i');
  function ready() {
    body.classList.add('is-ready');
    setTimeout(() => body.classList.add('is-intro-done'), reduce ? 0 : 2600);
  }
  (function runLoader() {
    if (reduce || !loaderNum) { ready(); return; }
    const dur = 1500; const t0 = performance.now();
    let fontsOk = false;
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(r => setTimeout(r, 2600))]).then(() => { fontsOk = true; });
    const step = now => {
      let t = clamp((now - t0) / dur);
      if (!fontsOk) t = Math.min(t, .92);
      const e = 1 - Math.pow(1 - t, 3);
      loaderNum.textContent = String(Math.round(e * 100)).padStart(3, '0');
      loaderBar.style.transform = `scaleX(${e})`;
      if (t < 1) requestAnimationFrame(step); else setTimeout(ready, 180);
    };
    requestAnimationFrame(step);
  })();

  /* ---------- Révélations à l'entrée dans l'écran ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target; el.classList.add('in'); io.unobserve(el);
      $$('[data-count]', el).forEach(count);
      if (el.matches('[data-count]')) count(el);
    });
  }, { threshold: .14, rootMargin: '0px 0px -7% 0px' });
  $$('[data-reveal], [data-words]').forEach(el => io.observe(el));

  /* Compteurs */
  const counted = new WeakSet();
  function count(el) {
    if (counted.has(el)) return; counted.add(el);
    const end = +el.dataset.count; if (reduce) { el.textContent = end; return; }
    const dur = 1500 + Math.min(end, 100) * 6; const t0 = performance.now();
    el.textContent = '0';
    const step = now => {
      const t = clamp((now - t0) / dur); const e = 1 - Math.pow(1 - t, 4);
      el.textContent = Math.round(end * e);
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  // Les compteurs hors d'un bloc révélé ont leur propre observation.
  $$('[data-count]').forEach(el => { if (!el.closest('[data-reveal]')) io.observe(el); });

  /* Étiquettes « décodées » */
  const GLYPHS = '!<>-_\\/[]{}=+*^?#01';
  function scramble(el) {
    const final = el.textContent; let f = 0; const total = 26;
    const tick = () => {
      let out = '';
      for (let i = 0; i < final.length; i++) {
        const at = (i / final.length) * total * .75;
        out += f >= at + 5 || final[i] === ' ' ? final[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (f++ < total + 6) setTimeout(tick, 34); else el.textContent = final;
    };
    tick();
  }
  if (!reduce) {
    const ioS = new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting) { ioS.unobserve(en.target); setTimeout(() => scramble(en.target), en.target.closest('.hero') ? 1500 : 100); }
    }), { threshold: .6 });
    $$('[data-scramble]').forEach(el => ioS.observe(el));
  }

  /* ---------- Phrase qui s'éclaire au défilement ---------- */
  const statement = $('[data-statement]');
  let stWords = [];
  if (statement && !reduce) {
    splitWords(statement, 'sw', null);
    stWords = $$('.sw', statement);
    stWords.forEach(w => w.style.setProperty('--o', .16));
  }

  /* ---------- Mesures mises en cache ---------- */
  let vh = innerHeight, vw = innerWidth, docH = 1;
  const M = { cases: [], st: null, tl: null, drift: null, sections: [] };
  const topOf = el => el.getBoundingClientRect().top + scrollY;
  function measure() {
    vh = innerHeight; vw = innerWidth; docH = Math.max(1, root.scrollHeight - vh);
    M.cases = $$('[data-case]').map(el => {
      const view = $('.browser__view', el), img = $('img', view);
      const sticky = getComputedStyle($('.case__visual', el)).position === 'sticky';
      const viewH = view.clientHeight;
      const imgH = img.naturalWidth ? view.clientWidth * (img.naturalHeight / img.naturalWidth) : view.clientWidth * (img.height / img.width);
      return { el, img, sticky, top: topOf(el), h: el.offsetHeight, vTop: topOf(view), viewH, travel: Math.max(0, imgH - viewH) };
    });
    if (statement) M.st = { top: topOf(statement), h: statement.offsetHeight };
    const tl = $('[data-timeline]'); if (tl) M.tl = { top: topOf(tl), h: tl.offsetHeight, bar: $('.tl__line i', tl) };
    const dr = $('[data-drift]'); if (dr) M.drift = { el: dr, top: topOf(dr.parentElement) };
    M.sections = $$('[data-nav]').map(a => { const s = $(a.getAttribute('href')); return s ? { a, top: topOf(s), h: s.offsetHeight } : null; }).filter(Boolean);
  }
  let mT; const remeasure = () => { clearTimeout(mT); mT = setTimeout(measure, 120); };
  addEventListener('resize', remeasure);
  addEventListener('load', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  if ('ResizeObserver' in window) new ResizeObserver(remeasure).observe(body);
  $$('.browser__view img').forEach(img => img.addEventListener('load', measure));
  measure();

  /* ---------- Bandeau défilant ---------- */
  const rows = $$('.marquee__row').map(row => {
    const track = $('.marquee__track', row);
    for (let i = 0; i < 3; i++) row.append(track.cloneNode(true));
    return { row, track, dir: +row.dataset.speed || 1, x: 0 };
  });

  /* ---------- Boucle d'animation liée au défilement ---------- */
  const nav = $('.nav'); const progress = $('.progress i'); const heroTitle = $('.hero__title');
  let sy = scrollY, lastSy = sy, vel = 0, navHidden = false;

  function frame() {
    sy = scrollY; vel = lerp(vel, sy - lastSy, .12);
    const dy = sy - lastSy; lastSy = sy;

    progress.style.transform = `scaleX(${clamp(sy / docH)})`;

    // Navigation : fond au défilement, masquée en descendant, visible en remontant.
    nav.classList.toggle('is-scrolled', sy > 40);
    if (!body.classList.contains('menu-open')) {
      if (dy > 4 && sy > 500 && !navHidden) { navHidden = true; nav.classList.add('is-hidden'); }
      else if ((dy < -4 || sy < 200) && navHidden) { navHidden = false; nav.classList.remove('is-hidden'); }
    }
    let current = null;
    for (const s of M.sections) if (sy + vh * .4 >= s.top) current = s;
    for (const s of M.sections) s.a.classList.toggle('is-active', s === current);

    if (!reduce) {
      // Titre du hero : léger effet de profondeur.
      if (sy < vh * 1.2 && heroTitle) heroTitle.style.transform = `translate3d(0, ${sy * .16}px, 0)`;

      // Bandeau : vitesse de base + élan donné par le défilement.
      for (const r of rows) {
        const w = r.track.offsetWidth || 1;
        r.x -= (0.7 + Math.abs(vel) * .32) * r.dir;
        if (r.x <= -w) r.x += w; if (r.x > 0) r.x -= w;
        r.row.style.transform = `translate3d(${r.x}px, 0, 0) skewX(${clamp(vel * -.12, -7, 7)}deg)`;
      }

      // Phrase qui s'éclaire mot à mot.
      if (M.st && stWords.length) {
        const p = clamp((sy + vh * .82 - M.st.top) / (M.st.h + vh * .34));
        const n = stWords.length;
        for (let k = 0; k < n; k++) stWords[k].style.setProperty('--o', (.16 + .84 * clamp(p * (n + 4) - k)).toFixed(3));
      }

      // Les captures défilent dans leur fenêtre pendant la lecture de l'étude de cas.
      for (const c of M.cases) {
        const p = c.sticky ? clamp((sy - c.top) / Math.max(1, c.h - vh)) : clamp((sy + vh * .75 - c.vTop) / (vh * .9 + c.viewH));
        c.img.style.transform = `translate3d(0, ${-c.travel * p}px, 0)`;
      }

      // Nom géant du pied de page.
      if (M.drift) M.drift.el.style.transform = `translate3d(${-((sy + vh - M.drift.top) * .32) - 40}px, 0, 0)`;
    }

    // Ligne du parcours.
    if (M.tl) M.tl.bar.style.transform = `scaleY(${reduce ? 1 : clamp((sy + vh * .62 - M.tl.top) / M.tl.h)})`;

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- Menu mobile ---------- */
  const burger = $('.nav__burger'); const menu = $('#menu');
  function setMenu(open) {
    body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.setAttribute('aria-hidden', !open);
    body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  /* ---------- Rôles qui tournent ---------- */
  const rot = $$('.rotator span');
  if (rot.length > 1 && !reduce) {
    let k = 0;
    setInterval(() => {
      const prev = rot[k]; k = (k + 1) % rot.length; const next = rot[k];
      prev.classList.remove('is-on'); prev.classList.add('is-off');
      next.classList.remove('is-off'); next.classList.add('is-on');
      setTimeout(() => prev.classList.remove('is-off'), 750);
    }, 2600);
  }

  /* ---------- Curseur, aimants, inclinaison 3D ---------- */
  if (fine && !reduce) {
    const cur = $('.cursor'), dot = $('.cursor-dot'), label = $('.cursor__label');
    let mx = -100, my = -100, cx = -100, cy = -100, shown = false;
    addEventListener('pointermove', e => {
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; cx = mx; cy = my; cur.classList.add('is-on'); dot.classList.add('is-on'); }
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    }, { passive: true });
    document.addEventListener('pointerleave', () => { shown = false; cur.classList.remove('is-on'); dot.classList.remove('is-on'); });
    (function loop() {
      cx = lerp(cx, mx, .17); cy = lerp(cy, my, .17);
      cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    })();
    document.addEventListener('pointerover', e => {
      const lab = e.target.closest('[data-cursor]');
      const link = e.target.closest('a, button');
      cur.classList.toggle('is-label', !!lab);
      cur.classList.toggle('is-link', !lab && !!link);
      if (lab) label.textContent = lab.dataset.cursor;
    });

    $$('.magnetic').forEach(el => {
      let raf;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * .32, y = (e.clientY - r.top - r.height / 2) * .32;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { el.style.transition = 'transform .15s ease-out'; el.style.transform = `translate(${x}px, ${y}px)`; });
      });
      el.addEventListener('pointerleave', () => { el.style.transition = 'transform .7s cubic-bezier(.2,.8,.2,1)'; el.style.transform = ''; });
    });

    $$('.tilt').forEach(el => {
      const max = el.classList.contains('bcard') ? 5 : 8;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.classList.add('is-tilting');
        el.style.setProperty('--ry', `${(px - .5) * max * 2}deg`);
        el.style.setProperty('--rx', `${(.5 - py) * max * 2}deg`);
        el.style.setProperty('--gx', `${px * 100}%`); el.style.setProperty('--gy', `${py * 100}%`);
      });
      el.addEventListener('pointerleave', () => {
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ---------- Compétences : pastilles de provenance + filtre ---------- */
  const SRC = { h: 'var(--c-apricot)', d: 'var(--c-sky)', e: 'var(--c-lav)', i: 'var(--c-mint)' };
  const NAMES = { h: 'Les Macarons Hottekiet', d: 'Les Douceurs du Monde', e: 'ESAIP et Erasmus', i: "Innov'LAB" };
  const skills = $$('.sk li');
  skills.forEach(li => {
    const srcs = li.dataset.src.split(' ');
    const dots = document.createElement('span'); dots.className = 'dots';
    srcs.forEach(s => { const d = document.createElement('i'); d.style.setProperty('--c', SRC[s]); dots.append(d); });
    li.append(dots);
    li.title = 'Mise en œuvre : ' + srcs.map(s => NAMES[s]).join(', ');
  });
  const countEl = $('.filter__count b');
  const countLabel = $('.filter__count');
  function applyFilter(f) {
    let n = 0;
    skills.forEach(li => {
      const hit = f === 'all' || li.dataset.src.split(' ').includes(f);
      li.classList.toggle('is-dim', !hit);
      li.classList.toggle('is-hit', hit && f !== 'all');
      if (hit) { n++; if (f !== 'all') li.style.setProperty('--hit', SRC[f]); }
    });
    if (countEl) { countEl.textContent = n; countLabel.lastChild.textContent = n > 1 ? ' compétences' : ' compétence'; }
  }
  $$('.filter button').forEach(btn => btn.addEventListener('click', () => {
    $$('.filter button').forEach(b => { b.classList.toggle('is-on', b === btn); b.setAttribute('aria-pressed', b === btn); });
    applyFilter(btn.dataset.filter);
  }));
  applyFilter('all');

  /* ---------- Radar « métier visé » ---------- */
  (function radar() {
    const svg = $('.radar__svg'); const items = $$('.axes > li'); if (!svg || !items.length) return;
    const NS = 'http://www.w3.org/2000/svg';
    const mk = (tag, attrs = {}, parent = svg) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.append(n); return n; };
    svg.setAttribute('viewBox', '-212 -158 424 316');
    const R = 122, n = items.length;
    const pt = (i, r) => { const a = -Math.PI / 2 + (i / n) * Math.PI * 2; return [Math.cos(a) * r, Math.sin(a) * r]; };
    const poly = r => items.map((_, i) => pt(i, r).map(v => v.toFixed(1)).join(',')).join(' ');

    const defs = mk('defs');
    const fill = mk('radialGradient', { id: 'radarFill', cx: '50%', cy: '50%', r: '65%' }, defs);
    mk('stop', { offset: '0', 'stop-color': '#ff5d8f', 'stop-opacity': '.5' }, fill);
    mk('stop', { offset: '1', 'stop-color': '#b49bff', 'stop-opacity': '.28' }, fill);
    const stroke = mk('linearGradient', { id: 'radarStroke', x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
    mk('stop', { offset: '0', 'stop-color': '#ff9d5c' }, stroke); mk('stop', { offset: '.5', 'stop-color': '#ff5d8f' }, stroke); mk('stop', { offset: '1', 'stop-color': '#b49bff' }, stroke);
    const sw = mk('linearGradient', { id: 'radarSweep', x1: '0', y1: '0', x2: '1', y2: '0' }, defs);
    mk('stop', { offset: '0', 'stop-color': '#7ef0c8', 'stop-opacity': '0' }, sw); mk('stop', { offset: '1', 'stop-color': '#7ef0c8', 'stop-opacity': '.3' }, sw);

    [1, 2, 3].forEach(l => mk('polygon', { class: `ring ring--${l}`, points: poly((R / 3) * l) }));
    items.forEach((_, i) => { const [x, y] = pt(i, R); mk('line', { class: 'spoke', x1: 0, y1: 0, x2: x.toFixed(1), y2: y.toFixed(1) }); });
    if (!reduce) mk('path', { class: 'sweep', d: `M0,0 L${R},0 A${R},${R} 0 0,0 ${(R * Math.cos(-.7)).toFixed(1)},${(R * Math.sin(-.7)).toFixed(1)} Z`, fill: 'url(#radarSweep)' });
    mk('polygon', { class: 'shape', points: items.map((li, i) => pt(i, (R / 3) * +li.dataset.v).map(v => v.toFixed(1)).join(',')).join(' ') });

    items.forEach((li, i) => {
      const [x, y] = pt(i, (R / 3) * +li.dataset.v);
      const c = mk('circle', { class: 'pt', cx: x.toFixed(1), cy: y.toFixed(1), r: 5.5 }); c.style.setProperty('--i', i);
      const [lx, ly] = pt(i, R + 16);
      const anchor = Math.abs(lx) < 8 ? 'middle' : lx > 0 ? 'start' : 'end';
      const t = mk('text', { class: 'lbl', x: lx.toFixed(1), y: (ly + (ly > 8 ? 9 : ly < -8 ? -3 : 3)).toFixed(1), 'text-anchor': anchor });
      t.textContent = li.dataset.short;
      const hot = on => { c.classList.toggle('is-hot', on); t.classList.toggle('is-hot', on); li.classList.toggle('is-hot', on); };
      li.addEventListener('pointerenter', () => hot(true)); li.addEventListener('pointerleave', () => hot(false));
      c.addEventListener('pointerenter', () => hot(true)); c.addEventListener('pointerleave', () => hot(false));
    });
  })();

  /* ---------- Attestation : le bouton n'apparaît que si le fichier est présent ---------- */
  const att = $('[data-attestation]');
  if (att && location.protocol.startsWith('http')) {
    fetch(att.getAttribute('href'), { method: 'HEAD' }).then(r => { if (r.ok) att.hidden = false; }).catch(() => {});
  }

  /* ---------- Fond animé du hero (WebGL) ---------- */
  (function aurora() {
    const canvas = $('.hero__canvas'); if (!canvas || reduce) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    const vs = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
    const fs = `
      precision highp float;
      uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
      vec3 mod289(vec3 x){ return x - floor(x * (1. / 289.)) * 289.; }
      vec2 mod289(vec2 x){ return x - floor(x * (1. / 289.)) * 289.; }
      vec3 permute(vec3 x){ return mod289(((x * 34.) + 1.) * x); }
      float snoise(vec2 v){
        const vec4 C = vec4(.211324865405187, .366025403784439, -.577350269189626, .024390243902439);
        vec2 i = floor(v + dot(v, C.yy)); vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1., 0.) : vec2(0., 1.);
        vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0., i1.y, 1.)) + i.x + vec3(0., i1.x, 1.));
        vec3 m = max(.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.);
        m = m * m; m = m * m;
        vec3 x = 2. * fract(p * C.www) - 1.; vec3 h = abs(x) - .5; vec3 ox = floor(x + .5); vec3 a0 = x - ox;
        m *= 1.79284291400159 - .85373472095314 * (a0 * a0 + h * h);
        vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 130. * dot(m, g);
      }
      float fbm(vec2 p){ float a = .5, f = 0.; for (int i = 0; i < 3; i++) { f += a * snoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= .5; } return f; }
      void main(){
        vec2 p = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
        vec2 m = (uMouse - .5) * vec2(uRes.x / uRes.y, 1.);
        float t = uTime * .05;
        vec2 q = vec2(fbm(p * .55 + vec2(t, -t * .7)), fbm(p * .55 + vec2(4.3 - t * .8, 1.1 + t)));
        vec2 r = vec2(fbm(p * .8 + q * 1.25 + vec2(1.7, 9.2) + t * 1.2 + m * .25), fbm(p * .8 + q * 1.25 + vec2(8.3, 2.8) - t));
        float f = fbm(p * .7 + r * 1.15);
        vec3 rasp = vec3(1., .365, .56), lav = vec3(.706, .608, 1.), apr = vec3(1., .616, .36), mint = vec3(.494, .94, .784);
        vec3 col = mix(lav, rasp, smoothstep(-.5, .5, f));
        col = mix(col, apr, smoothstep(.05, .85, r.x));
        col = mix(col, mint, smoothstep(.25, .95, q.y) * .55);
        float ribbon = smoothstep(-.15, .75, f + r.y * .45);
        float halo = smoothstep(1.25, .1, length(p - vec2(.34, .04) - m * .22));
        float glow = smoothstep(.55, 0., length(p - m)) * .22;
        float k = clamp(ribbon * halo * .92 + glow, 0., 1.);
        vec3 bg = vec3(.027, .027, .047);
        col = mix(bg, col, k);
        col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453) - .5) * .035;
        gl_FragColor = vec4(col, 1.);
      }`;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const v = sh(gl.VERTEX_SHADER, vs), f = sh(gl.FRAGMENT_SHADER, fs); if (!v || !f) return;
    const prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime'), uMouse = gl.getUniformLocation(prog, 'uMouse');

    const SCALE = .55; let w = 0, h = 0;
    const resize = () => {
      w = Math.max(2, Math.round(canvas.clientWidth * SCALE)); h = Math.max(2, Math.round(canvas.clientHeight * SCALE));
      canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h);
    };
    resize(); addEventListener('resize', resize);

    let tx = .62, ty = .55, mx = tx, my = ty, visible = true;
    const hero = $('.hero');
    hero.addEventListener('pointermove', e => { const r = hero.getBoundingClientRect(); tx = (e.clientX - r.left) / r.width; ty = 1 - (e.clientY - r.top) / r.height; }, { passive: true });
    new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(hero);
    canvas.classList.add('is-live');
    const t0 = performance.now();
    (function draw(now) {
      if (visible && !document.hidden) {
        mx = lerp(mx, tx, .04); my = lerp(my, ty, .04);
        gl.uniform2f(uRes, w, h); gl.uniform1f(uTime, (now - t0) / 1000 + 20); gl.uniform2f(uMouse, mx, my);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      requestAnimationFrame(draw);
    })(t0);
  })();

  /* ---------- Borne d'arcade (animation en pixels, originale) ---------- */
  (function arcade() {
    const cv = $('.arcade__screen canvas'); if (!cv) return;
    const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height;
    const FONT = { A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], E: [7, 4, 6, 4, 7], I: [7, 2, 2, 2, 7], L: [4, 4, 4, 4, 7], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], V: [5, 5, 5, 5, 2], X: [5, 5, 2, 5, 5], "'": [2, 2, 0, 0, 0], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 6, 5, 2], 7: [7, 1, 2, 2, 2], 8: [2, 5, 2, 5, 2], 9: [2, 5, 3, 1, 6] };
    const text = (str, x, y, color, s = 1) => {
      ctx.fillStyle = color;
      [...str].forEach((ch, k) => {
        const g = FONT[ch]; if (!g) return;
        for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (g[r] & (4 >> c)) ctx.fillRect(x + (k * 4 + c) * s, y + r * s, s, s);
      });
    };
    const widthOf = (str, s = 1) => (str.length * 4 - 1) * s;
    const PALS = [['#ff5d8f', '#ffd666', '#7ef0c8', '#b49bff'], ['#7ef0c8', '#6db3ff', '#b49bff', '#ffd666'], ['#ff9d5c', '#ff5d8f', '#ffd666', '#7ef0c8']];
    let pal = 0, score = 2, tick = 0, flash = 0;
    const stars = Array.from({ length: 34 }, () => ({ x: Math.random() * W, y: Math.random() * H, v: .15 + Math.random() * .7 }));
    const ball = { x: 40, y: 50, vx: 1.15, vy: .85 };
    const trail = []; let parts = [];
    const burst = (x, y, n) => { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = .4 + Math.random() * 2; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 18 + Math.random() * 22, c: (Math.random() * 4) | 0 }); } };

    function step() {
      tick++;
      const P = PALS[pal];
      ctx.fillStyle = flash > 0 ? '#1a1430' : '#06060f'; ctx.fillRect(0, 0, W, H); if (flash > 0) flash--;
      stars.forEach(s => { s.y += s.v; if (s.y > H) { s.y = 0; s.x = Math.random() * W; } ctx.fillStyle = s.v > .55 ? '#8f8ab0' : '#3c3858'; ctx.fillRect(s.x | 0, s.y | 0, 1, 1); });

      const title = "INNOV'LAB"; text(title, ((W - widthOf(title, 2)) / 2) | 0, 36, '#211c3a', 2);

      ball.x += ball.vx; ball.y += ball.vy;
      let hit = false;
      if (ball.x < 2 || ball.x > W - 6) { ball.vx *= -1; hit = true; }
      if (ball.y < 12 || ball.y > H - 16) { ball.vy *= -1; hit = true; }
      if (hit) burst(ball.x + 2, ball.y + 2, 6);
      trail.push({ x: ball.x, y: ball.y }); if (trail.length > 14) trail.shift();
      trail.forEach((t, i) => { ctx.globalAlpha = (i / trail.length) * .6; ctx.fillStyle = P[i % 4]; ctx.fillRect(t.x | 0, t.y | 0, 4, 4); });
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(ball.x | 0, ball.y | 0, 4, 4);

      parts = parts.filter(p => p.life > 0);
      parts.forEach(p => { p.x += p.vx; p.y += p.vy; p.vy += .05; p.life--; ctx.fillStyle = P[p.c]; ctx.fillRect(p.x | 0, p.y | 0, p.life > 12 ? 2 : 1, p.life > 12 ? 2 : 1); });

      text('SCORE', 4, 3, P[1]); text(String(score).padStart(4, '0'), 28, 3, '#fff');
      text('2 BORNES', W - widthOf('2 BORNES') - 4, 3, P[2]);
      if ((tick >> 4) & 1) { const s = 'PRESS A'; text(s, ((W - widthOf(s)) / 2) | 0, H - 9, P[0]); }
      ctx.fillStyle = P[3]; ctx.fillRect(0, 10, W, 1); ctx.fillRect(0, H - 12, W, 1);
    }

    let on = false, last = 0;
    new IntersectionObserver(es => { on = es[0].isIntersecting; }).observe(cv);
    function loop(now) { if (on && !document.hidden && now - last > 33) { last = now; step(); } requestAnimationFrame(loop); }
    if (reduce) { step(); } else requestAnimationFrame(loop);

    $('.arcade__btn--a').addEventListener('click', () => { burst(ball.x + 2, ball.y + 2, 46); score = (score + 1) % 10000; flash = 3; ball.vx *= -1; if (reduce) step(); });
    $('.arcade__btn--b').addEventListener('click', () => { pal = (pal + 1) % PALS.length; flash = 2; if (reduce) step(); });
  })();
})();
