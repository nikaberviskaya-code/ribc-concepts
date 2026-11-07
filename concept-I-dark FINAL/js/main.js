document.addEventListener('DOMContentLoaded', function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = matchMedia('(hover: hover)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- Монеты: настоящая толщина из срезов, без WebGL ---- */
  $$('.coin').forEach(function (c) {
    var size = parseFloat(getComputedStyle(c).width) || 150;
    var T = Math.round(size * 0.085), n = Math.max(8, Math.round(T / 1.1)), i, s, glyph = c.getAttribute('data-glyph') || '';
    c.setAttribute('aria-hidden', 'true');
    for (i = 0; i < n; i++) {
      s = document.createElement('i'); s.className = 'coin__s';
      s.style.transform = 'translateZ(' + (((i / (n - 1)) - .5) * T).toFixed(2) + 'px)';
      c.appendChild(s);
    }
    ['f', 'b'].forEach(function (k) {
      var face = document.createElement('i'), g = document.createElement('span');
      face.className = 'coin__' + k; g.textContent = glyph; var tk = document.createElement('b'); tk.className = 'coin__t'; face.appendChild(tk); face.appendChild(g);
      face.style.transform = (k === 'b' ? 'rotateY(180deg) ' : '') + 'translateZ(' + (T / 2 + .5) + 'px)';
      c.appendChild(face);
    });
  });

  /* ---- Header: стекло после hero, прячется вниз / возвращается вверх ---- */
  var header = $('#siteHeader'), lastY = 0, ticking = false;
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('is-stuck', y > 40);
    if (y > 320 && y > lastY + 6) header.classList.add('is-hidden');
    else if (y < lastY - 6 || y < 320) header.classList.remove('is-hidden');
    lastY = y; ticking = false;
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
  $$('a[href^="#"]').forEach(function (a) { a.addEventListener('click', function () { header.classList.remove('is-hidden'); }); });

  /* ---- Мобильное меню ---- */
  var burger = $('#burger'), menu = $('#menu'), root = document.documentElement;
  function setMenu(open) {
    root.classList.toggle('menu-open', open);
    document.body.classList.toggle('menu-lock', open);
    menu.classList.toggle('open', open);
    if (open) { menu.removeAttribute('inert'); menu.removeAttribute('aria-hidden'); header.classList.remove('is-hidden'); }
    else { menu.setAttribute('inert', ''); menu.setAttribute('aria-hidden', 'true'); }
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  }
  burger.addEventListener('click', function () { setMenu(!menu.classList.contains('open')); });
  $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); burger.focus(); } });
  matchMedia('(min-width: 901px)').addEventListener('change', function (m) { if (m.matches) setMenu(false); });

  /* ---- Подсветка текущего раздела ---- */
  if ('IntersectionObserver' in window) {
    var links = $$('.nav a.lnk');
    var spy = new IntersectionObserver(function (list) {
      list.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['about', 'directions'].forEach(function (id) { var n = document.getElementById(id); if (n) spy.observe(n); });
  }

  /* ---- Световое пятно за курсором на карточках ---- */
  $$('.pil, .tile, .ev').forEach(function (t) {
    t.addEventListener('pointermove', function (e) {
      var r = t.getBoundingClientRect();
      t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      t.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---- Форма (демо: данные никуда не отправляются) ---- */
  var form = $('#joinForm');
  var rules = {
    'f-name': function (v) { return v.trim().split(/\s+/).length >= 2 && v.trim().length > 3; },
    'f-co': function (v) { return v.trim().length > 1; },
    'f-mail': function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); }
  };
  function validateField(id) {
    var el = document.getElementById(id), wrap = el.closest('.fld'), ok = rules[id](el.value);
    wrap.classList.toggle('err', !ok);
    el.setAttribute('aria-invalid', String(!ok));
    return ok;
  }
  Object.keys(rules).forEach(function (id) {
    var el = document.getElementById(id);
    el.addEventListener('blur', function () { if (el.value) validateField(id); });
    el.addEventListener('input', function () { if (el.closest('.fld').classList.contains('err')) validateField(id); });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var good = true, first = null;
    Object.keys(rules).forEach(function (id) { if (!validateField(id)) { good = false; first = first || document.getElementById(id); } });
    if (!good) {
      first.focus();
      if (window.gsap && !reduce) gsap.fromTo(form, { x: -8 }, { x: 0, duration: .4, ease: 'elastic.out(1,.35)', clearProps: 'transform' });
      return;
    }
    var btn = $('button[type=submit]', form);
    btn.disabled = true; $('.lbl', btn).textContent = 'Отправляем…';
    setTimeout(function () {
      /* для просмотра состояния ошибки: откройте страницу с #join-error */
      var fail = location.hash === '#join-error';
      $(fail ? '#formFail' : '#formOk').classList.add('show');
      btn.disabled = false; $('.lbl', btn).textContent = 'Отправить';
      $(fail ? '#failTitle' : '#okTitle').focus({ preventScroll: true });
    }, 900);
  });
  $('#okReset').addEventListener('click', function () {
    form.reset();
    $$('.fld', form).forEach(function (n) { n.classList.remove('err'); });
    $$('[aria-invalid]', form).forEach(function (n) { n.removeAttribute('aria-invalid'); });
    $('#formOk').classList.remove('show');
    $('#f-name').focus();
  });
  $('#failReset').addEventListener('click', function () {
    $('#formFail').classList.remove('show');
    $('button[type=submit]', form).focus();
  });

  /* ---- Всё ниже — только если GSAP загрузился и движение разрешено ---- */
  window.__ribcReady = true;
  if (!window.gsap || !window.ScrollTrigger || reduce) {
    document.documentElement.classList.remove('anim');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* Слова в заголовках: маска + подъём (курсивные вставки сохраняются) */
  function splitWords(h) {
    h.setAttribute('aria-label', h.textContent.trim().replace(/\s+/g, ' '));
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span'), s = document.createElement('span');
            w.className = 'w'; w.setAttribute('aria-hidden', 'true'); s.textContent = p; w.appendChild(s); frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) walk(n);
      });
    })(h);
  }
  $$('[data-split]').forEach(function (h) {
    splitWords(h);
    ScrollTrigger.create({
      trigger: h, start: 'top 88%', once: true,
      onEnter: function () { gsap.to($$('.w > span', h), { yPercent: 0, y: 0, duration: .95, stagger: .05, ease: 'power4.out' }); }
    });
  });
  gsap.set('.w > span', { yPercent: 118 });

  /* Цитата: слова «проявляются» вместе со скроллом */
  var q = $('#quoteText');
  q.setAttribute('aria-label', q.textContent.trim());
  q.innerHTML = q.textContent.trim().split(/\s+/).map(function (w) { return '<span class="qw" aria-hidden="true">' + w + '</span>'; }).join(' ');
  gsap.fromTo('.qw', { opacity: .18 }, {
    opacity: 1, ease: 'none', stagger: .12,
    scrollTrigger: { trigger: q, start: 'top 84%', end: 'bottom 54%', scrub: .6 }
  });

  /* Hero: «шёлковые» линии прорисовываются, текст выезжает из-под маски */
  $$('.fp').forEach(function (p, i) {
    var len = p.getTotalLength();
    gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(p, { strokeDashoffset: 0, duration: 2.8, delay: .3 + i * .25, ease: 'power2.out' });
  });
  gsap.from('.blob .b', { opacity: 0, scale: .82, duration: 2.2, stagger: .18, ease: 'power2.out' });
  function playIntro() {
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .fromTo('.hdr', { yPercent: -140, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .9 }, .1)
      .to('.hero h1 .ln > span', { yPercent: 0, y: 0, duration: 1.2, stagger: .14 }, .25)
      .to('.hero__lead', { opacity: 1, y: 0, duration: .9 }, .85)
      .to('.hero .btn--lg', { opacity: 1, y: 0, duration: .9, clearProps: 'transform' }, 1);
  }
  if (document.fonts && document.fonts.ready) {
    var started = false, go = function () { if (!started) { started = true; playIntro(); } };
    document.fonts.ready.then(go); setTimeout(go, 900);
  } else playIntro();

  /* Hero: параллакс света за курсором и при скролле */
  if (canHover) {
    var bx = gsap.quickTo('.blob', 'x', { duration: 1.4, ease: 'power3' }), by = gsap.quickTo('.blob', 'y', { duration: 1.4, ease: 'power3' });
    $('.hero').addEventListener('pointermove', function (e) {
      bx((e.clientX / innerWidth - .5) * -50); by((e.clientY / innerHeight - .5) * -40);
    });
  }
  gsap.to('.blob', { yPercent: 16, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* Универсальное появление блоков */
  gsap.set('[data-reveal]', { y: 30, opacity: .2 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%', once: true, interval: .1, batchMax: 6,
    onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: .9, stagger: .08, ease: 'power3.out', overwrite: true, clearProps: 'transform' }); }
  });

  /* Плитки направлений: волна по сетке */
  var tiles = $$('.tile');
  gsap.set(tiles, { autoAlpha: 0, y: 30, scale: .96 });
  ScrollTrigger.create({
    trigger: '#grid8', start: 'top 84%', once: true,
    onEnter: function () { gsap.to(tiles, { autoAlpha: 1, y: 0, scale: 1, duration: .85, ease: 'power3.out', stagger: { each: .055, from: 'start' }, clearProps: 'transform' }); }
  });

  /* Счётчик «20» */
  var cnt = $('[data-count]'), cv = { v: 0 }, target = +cnt.dataset.count;
  cnt.textContent = '0';
  ScrollTrigger.create({
    trigger: cnt, start: 'top 92%', once: true,
    onEnter: function () { gsap.to(cv, { v: target, duration: 1.6, ease: 'power2.out', onUpdate: function () { cnt.textContent = Math.round(cv.v); } }); }
  });

  /* Ленты в блоке мероприятий прорисовываются */
  $$('.rp').forEach(function (p, i) {
    var len = p.getTotalLength();
    gsap.set(p, { strokeDasharray: len, strokeDashoffset: len });
    gsap.to(p, { strokeDashoffset: 0, duration: 2.2, delay: i * .2, ease: 'power2.out', scrollTrigger: { trigger: '.events__panel', start: 'top 70%', once: true } });
  });

  /* Рупии: график рисуется, монеты «выкладываются» веером и слегка парят.
     Монеты анимируем через объекты-прокси и сами пишем CSS-переменные (GSAP ненадёжно твинит --var с единицами). */
  var al = $('.aline'), alen = al.getTotalLength();
  gsap.set(al, { strokeDasharray: alen, strokeDashoffset: alen });
  gsap.set('.area', { opacity: 0 });
  var coins = $$('#fan .coin').map(function (c, i) {
    var o = { el: c, i: i, dir: i % 2 ? 1 : -1,
      y: parseFloat(c.style.getPropertyValue('--y')) || 0,
      ry: parseFloat(c.style.getPropertyValue('--ry')) || 0,
      rz: parseFloat(c.style.getPropertyValue('--rz')) || 0 };
    o.p = { y: o.y + 600, ry: o.ry + o.dir * 10, rz: o.rz - o.dir * 4 };
    return o;
  });
  function paint(o) {
    o.el.style.setProperty('--y', o.p.y.toFixed(2) + 'px');
    o.el.style.setProperty('--ry', o.p.ry.toFixed(2) + 'deg');
    o.el.style.setProperty('--rz', o.p.rz.toFixed(2) + 'deg');
  }
  coins.forEach(paint); /* старт — внизу, за краем блока */
  var played = false;
  function playCoins() {
    if (played) return; played = true;
    gsap.to(al, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut' });
    gsap.to('.area', { opacity: 1, duration: 1.8, delay: .6 });
    coins.forEach(function (o) {
      /* без opacity: прозрачность делает 3D-монету плоской и толщина «выскакивает» */
      gsap.to(o.p, { y: o.y, ry: o.ry, rz: o.rz, duration: 2.4, delay: o.i * .14, ease: 'power3.out',
        onUpdate: function () { paint(o); },
        onComplete: function () {
          gsap.to(o.p, { ry: o.ry + o.dir * 4, rz: o.rz + o.dir * 1.5, duration: 5.5 + o.i * .8, ease: 'sine.inOut', yoyo: true, repeat: -1, onUpdate: function () { paint(o); } });
          gsap.to(o.p, { y: o.y - 9, duration: 4.2 + o.i * .6, ease: 'sine.inOut', yoyo: true, repeat: -1, onUpdate: function () { paint(o); } });
        } });
    });
  }
  ScrollTrigger.create({ trigger: '#rupeePanel', start: 'top 85%', once: true, onEnter: playCoins });
  /* страховка: если блок уже в зоне видимости, а триггер не сработал — запускаем сами */
  setTimeout(function () {
    var r = $('#rupeePanel').getBoundingClientRect();
    if (!played && r.top < innerHeight && r.bottom > 0) playCoins();
  }, 1200);

  /* Индикатор прогресса чтения */
  gsap.to('#progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  addEventListener('load', function () { ScrollTrigger.refresh(); });
});
