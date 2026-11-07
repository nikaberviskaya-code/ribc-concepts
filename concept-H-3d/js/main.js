document.addEventListener('DOMContentLoaded', function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- Header: светлое стекло после hero, прячется вниз / возвращается вверх ---- */
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
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function () { header.classList.remove('is-hidden'); });
  });

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
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) { setMenu(false); burger.focus(); }
  });
  matchMedia('(min-width: 901px)').addEventListener('change', function (m) { if (m.matches) setMenu(false); });

  /* ---- Подсветка текущего раздела в меню ---- */
  if ('IntersectionObserver' in window) {
    var links = $$('.nav a.lnk');
    var spy = new IntersectionObserver(function (list) {
      list.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (a) {
          if (a.getAttribute('href') === '#' + en.target.id) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    ['about', 'directions'].forEach(function (id) { var n = document.getElementById(id); if (n) spy.observe(n); });
  }

  /* ---- Подсветка плиток за курсором ---- */
  $$('.tile').forEach(function (t) {
    t.addEventListener('pointermove', function (e) {
      var r = t.getBoundingClientRect();
      t.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      t.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---- Лёгкий наклон карточек-столпов (только мышь, без reduced-motion) ---- */
  if (!reduce && matchMedia('(hover: hover)').matches) {
    $$('.pil').forEach(function (c) {
      c.addEventListener('pointermove', function (e) {
        var r = c.getBoundingClientRect();
        c.style.setProperty('--ry', (((e.clientX - r.left) / r.width - .5) * 6).toFixed(2) + 'deg');
        c.style.setProperty('--rx', ((.5 - (e.clientY - r.top) / r.height) * 5).toFixed(2) + 'deg');
      });
      c.addEventListener('pointerleave', function () { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
  }

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

  /* Слова в заголовках: маска + подъём */
  $$('[data-split]').forEach(function (h) {
    var words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true"><span>' + w + '</span></span>'; }).join(' ');
    ScrollTrigger.create({
      trigger: h, start: 'top 88%', once: true,
      onEnter: function () { gsap.to($$('.w > span', h), { yPercent: 0, y: 0, duration: .9, stagger: .05, ease: 'power4.out' }); }
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

  /* Intro hero: шапка, строки заголовка из-под маски, подзаголовок и кнопка (3D-кластер появляется сам в scene3d.js) */
  function playIntro() {
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .fromTo('.hdr', { yPercent: -140, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .9 }, .1)
      .to('.hero h1 .ln > span', { yPercent: 0, y: 0, duration: 1.1, stagger: .12 }, .25)
      .to('.hero__lead', { opacity: 1, y: 0, duration: .8 }, .75)
      .to('.hero .btn--lg', { opacity: 1, y: 0, duration: .8, clearProps: 'transform' }, .9);
  }
  if (document.fonts && document.fonts.ready) {
    var started = false, go = function () { if (!started) { started = true; playIntro(); } };
    document.fonts.ready.then(go); setTimeout(go, 900);
  } else playIntro();

  /* Универсальное появление блоков (батчем, stagger < 0.5 c) */
  gsap.set('[data-reveal]', { y: 30, opacity: .2 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%', once: true, interval: .1, batchMax: 6,
    onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: .85, stagger: .08, ease: 'power3.out', overwrite: true, clearProps: 'transform' }); }
  });

  /* Плитки направлений: волна по сетке */
  var tiles = $$('.tile');
  gsap.set(tiles, { autoAlpha: 0, y: 30, scale: .96 });
  ScrollTrigger.create({
    trigger: '#grid8', start: 'top 84%', once: true,
    onEnter: function () { gsap.to(tiles, { autoAlpha: 1, y: 0, scale: 1, duration: .8, ease: 'power3.out', stagger: { each: .055, from: 'start' }, clearProps: 'transform' }); }
  });

  /* Счётчик «20» и показатели: цифры «набираются» один раз */
  var cnt = $('[data-count]'), cv = { v: 0 }, target = +cnt.dataset.count;
  cnt.textContent = '0';
  ScrollTrigger.create({
    trigger: cnt, start: 'top 92%', once: true,
    onEnter: function () { gsap.to(cv, { v: target, duration: 1.5, ease: 'power2.out', onUpdate: function () { cnt.textContent = Math.round(cv.v); } }); }
  });
  var nums = $$('[data-n]');
  nums.forEach(function (el) { el.textContent = '0'; });
  ScrollTrigger.create({
    trigger: '.stats', start: 'top 85%', once: true,
    onEnter: function () {
      nums.forEach(function (el, i) {
        var o = { v: 0 };
        gsap.to(o, { v: +el.dataset.n, duration: 1.6, delay: i * .08, ease: 'power2.out', onUpdate: function () { el.textContent = Math.round(o.v); } });
      });
    }
  });

  /* Рупия ↔ рубль: пунктир «прорисовывается» между монетами */
  gsap.fromTo('.fx__line', { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power2.out', scrollTrigger: { trigger: '#rupeePanel', start: 'top 65%', once: true } });

  /* Индикатор прогресса чтения */
  gsap.to('#progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } });

  /* Страховка по высоте после подгрузки шрифтов и картинок */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  addEventListener('load', function () { ScrollTrigger.refresh(); });
});
