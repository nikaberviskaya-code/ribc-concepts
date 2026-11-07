document.addEventListener('DOMContentLoaded', function () {
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---- Header: стекло при скролле, прячется вниз / возвращается вверх ---- */
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
  matchMedia('(min-width: 641px)').addEventListener('change', function (m) { if (m.matches) setMenu(false); });

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
    /* ленточки в блоке заявки крутятся только пока видны */
    var jp = $('.join__panel');
    new IntersectionObserver(function (l) { jp.classList.toggle('is-off', !l[0].isIntersecting); }).observe(jp);
  }

  /* ---- Подсветка плиток за курсором ---- */
  $$('.tile').forEach(function (t) {
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
    'f-mail': function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    'f-tel': function (v) { return v.replace(/\D/g, '').length >= 10; }
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
  $$('.chk input', form).forEach(function (c) {
    c.addEventListener('change', function () { c.closest('.chk').classList.remove('err'); });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var good = true, first = null;
    Object.keys(rules).forEach(function (id) { if (!validateField(id)) { good = false; first = first || document.getElementById(id); } });
    $$('.chk', form).forEach(function (c) {
      var ok = c.querySelector('input').checked; c.classList.toggle('err', !ok);
      if (!ok) { good = false; first = first || c.querySelector('input'); }
    });
    if (!good) {
      first.focus();
      if (window.gsap && !reduce) gsap.fromTo(form, { x: -8 }, { x: 0, duration: .4, ease: 'elastic.out(1,.35)', clearProps: 'transform' });
      return;
    }
    var btn = $('button[type=submit]', form);
    btn.disabled = true; $('.lbl', btn).textContent = 'Отправляем…';
    setTimeout(function () {
      $('#formOk').classList.add('show');
      btn.disabled = false; $('.lbl', btn).textContent = 'Отправить заявку';
      $('#okTitle').focus({ preventScroll: true });
    }, 900);
  });
  $('#okReset').addEventListener('click', function () {
    form.reset();
    $$('.fld, .chk', form).forEach(function (n) { n.classList.remove('err'); });
    $$('[aria-invalid]', form).forEach(function (n) { n.removeAttribute('aria-invalid'); });
    $('#formOk').classList.remove('show');
    $('#f-name').focus();
  });

  /* ---- Заголовок hero растягивается ровно на ширину экрана ---- */
  var ht = $('#heroTitle'), hp = $('.hero__panel'), hin = $('.hero__in');
  function fitHero() {
    var first = $('.ln > span', ht); if (!first) return;
    ht.style.setProperty('--fs', '100px');
    var w100 = first.getBoundingClientRect().width, h100 = ht.getBoundingClientRect().height;
    if (!(w100 > 0 && h100 > 0)) return;
    var cs = getComputedStyle(hin);
    var availH = hp.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 96;
    var byW = 100 * ht.clientWidth / w100 * 0.994, byH = 100 * availH / h100;
    ht.style.setProperty('--fs', Math.max(34, Math.min(byW, byH)).toFixed(2) + 'px');
  }
  fitHero();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitHero);
  var rz; addEventListener('resize', function () { cancelAnimationFrame(rz); rz = requestAnimationFrame(fitHero); });

  /* ---- Всё ниже — только если GSAP загрузился и движение разрешено ---- */
  window.__ribcReady = true;
  if (!window.gsap || !window.ScrollTrigger || reduce) {
    document.documentElement.classList.remove('anim');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });
  var mm = gsap.matchMedia();

  /* Слова в заголовках: маска + подъём */
  $$('[data-split]').forEach(function (h) {
    var words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map(function (w) { return '<span class="w" aria-hidden="true"><span>' + w + '</span></span>'; }).join(' ');
    ScrollTrigger.create({
      trigger: h, start: 'top 86%', once: true,
      onEnter: function () { gsap.to($$('.w > span', h), { yPercent: 0, y: 0, duration: .9, stagger: .05, ease: 'power4.out' }); }
    });
  });
  gsap.set('.w > span', { yPercent: 118 });

  /* Цитата: слова «проявляются» вместе со скроллом */
  var q = $('#quoteText');
  q.setAttribute('aria-label', q.textContent.trim());
  q.innerHTML = q.textContent.trim().split(/\s+/).map(function (w) { return '<span class="qw" aria-hidden="true">' + w + '</span>'; }).join(' ');
  gsap.fromTo('.qw', { opacity: .14 }, {
    opacity: 1, ease: 'none', stagger: .12,
    scrollTrigger: { trigger: q, start: 'top 82%', end: 'bottom 52%', scrub: .6 }
  });

  /* Intro hero: сначала подпись и CTA, затем строки заголовка поднимаются из-под маски */
  function playIntro() {
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .fromTo('.hdr', { yPercent: -140, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .9 }, .1)
      .to('.hero h1 .ln > span', { yPercent: 0, y: 0, duration: 1.15, stagger: .12 }, .25);
  }
  if (document.fonts && document.fonts.ready) {
    var started = false, go = function () { if (!started) { started = true; fitHero(); playIntro(); } };
    document.fonts.ready.then(go); setTimeout(go, 900);
  } else playIntro();

  /* Hero на скролле: верхний текст уходит вверх, фон слегка отстаёт (без scroll-jacking) */
  gsap.to('.hero__gl', { yPercent: 7, scale: 1.04, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  /* Универсальное появление блоков (батчем, stagger < 0.5 c) */
  gsap.set('[data-reveal]', { y: 28, opacity: .22 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%', once: true, interval: .1, batchMax: 6,
    onEnter: function (els) { gsap.to(els, { opacity: 1, y: 0, duration: .85, stagger: .08, ease: 'power3.out', overwrite: true, clearProps: 'transform' }); }
  });

  /* Плитки направлений: волна по сетке */
  var tiles = $$('.tile');
  gsap.set(tiles, { autoAlpha: 0, y: 30, scale: .96 });
  ScrollTrigger.create({
    trigger: '#grid8', start: 'top 82%', once: true,
    onEnter: function () { gsap.to(tiles, { autoAlpha: 1, y: 0, scale: 1, duration: .8, ease: 'power3.out', stagger: { each: .055, grid: 'auto', from: 'start' }, clearProps: 'transform' }); }
  });

  /* Счётчик «20» */
  var cnt = $('[data-count]'), cv = { v: 0 }, target = +cnt.dataset.count;
  cnt.textContent = '0';
  ScrollTrigger.create({
    trigger: cnt, start: 'top 92%', once: true,
    onEnter: function () { gsap.to(cv, { v: target, duration: 1.5, ease: 'power2.out', onUpdate: function () { cnt.textContent = Math.round(cv.v); } }); }
  });

  /* Показатели: цифры «набираются» один раз */
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

  /* Рупия ↔ рубль: монеты сходятся без «третьей валюты» */
  var coinTl = gsap.timeline({ scrollTrigger: { trigger: '#rupeePanel', start: 'top 70%', once: true } });
  coinTl
    .fromTo('#coinR', { x: -36, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .9, ease: 'power3.out' }, 0)
    .fromTo('#coinI', { x: 36, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: .9, ease: 'power3.out' }, 0)
    .fromTo('#fxLine', { scaleX: 0, autoAlpha: 0 }, { scaleX: 1, autoAlpha: 1, duration: .7, ease: 'power2.out' }, .35)
    .fromTo('#fxFoot', { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .7, ease: 'power3.out' }, .6);
  var floats = [
    gsap.to('#coinR', { y: -6, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true }),
    gsap.to('#coinI', { y: 6, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1, paused: true })
  ];
  ScrollTrigger.create({ trigger: '#rupeePanel', start: 'top bottom', end: 'bottom top', onToggle: function (self) { floats.forEach(function (t) { self.isActive ? t.resume() : t.pause(); }); } });

  /* Индикатор прогресса чтения */
  gsap.to('#progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .3 } });

  /* Страховка по высоте после подгрузки шрифтов и картинок */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  addEventListener('load', function () { ScrollTrigger.refresh(); });
});
