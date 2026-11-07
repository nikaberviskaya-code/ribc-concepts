/* 3D-слой: один WebGL-холст поверх страницы. Каждый .a3d в вёрстке — «якорь»:
   объект рисуется в его прямоугольнике, едет вместе со скроллом, вращается от скролла и курсора.
   Three.js грузится лениво; без WebGL остаются CSS-градиентные шары (см. .a3d::before). */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canvas = document.getElementById('gl');
  var nodes = [].slice.call(document.querySelectorAll('.a3d'));
  if (!canvas || !nodes.length) return;

  function loadThree(cb) {
    if (window.THREE) return cb();
    var s = document.createElement('script');
    s.src = 'vendor/three.iife.js'; s.onload = cb; s.onerror = function () {};
    document.head.appendChild(s);
  }
  var idle = function (cb) { return 'requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 800 }) : setTimeout(cb, 120); };
  if (document.readyState === 'complete') idle(function () { loadThree(init); });
  else addEventListener('load', function () { idle(function () { loadThree(init); }); }, { once: true });

  function init() {
    var THREE = window.THREE, renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
    catch (e) { return; }
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    var scene = new THREE.Scene();
    var FOV = 22, camera = new THREE.PerspectiveCamera(FOV, 1, 10, 6000);
    var W = 1, H = 1;
    function resize() {
      W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 1.75));
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      var z = (H / 2) / Math.tan(FOV * Math.PI / 360);
      camera.position.set(0, 0, z); camera.near = z * .2; camera.far = z * 3;
      camera.updateProjectionMatrix();
    }
    resize();

    /* ---------- Окружение: мягкие «софтбоксы» для глянцевых отражений ---------- */
    function makeEnv() {
      var es = new THREE.Scene();
      var g = new THREE.SphereGeometry(60, 48, 24), p = g.attributes.position;
      var col = new Float32Array(p.count * 3), c = new THREE.Color();
      var top = new THREE.Color('#E6FBF0').multiplyScalar(1.6), mid = new THREE.Color('#2E9A78'), bot = new THREE.Color('#031A12');
      for (var i = 0; i < p.count; i++) {
        var t = (p.getY(i) / 60 + 1) / 2;
        if (t > .5) c.copy(mid).lerp(top, (t - .5) * 2); else c.copy(bot).lerp(mid, t * 2);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      function box(color, k, w, h, x, y, z) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
      }
      box('#ffffff', 9, 36, 22, -26, 34, 24);
      box('#FFB36B', 6, 10, 38, 36, 4, 12);
      box('#8CE8BE', 5, 8, 30, -38, -8, 18);
      box('#ffffff', 3.5, 50, 8, 0, -22, 34);
      var pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(es, .02);
      pm.dispose();
      return rt.texture;
    }
    scene.environment = makeEnv();
    var key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-300, 420, 600); scene.add(key);
    var rim = new THREE.DirectionalLight(0xFFB070, 1.1); rim.position.set(520, -120, -240); scene.add(rim);

    /* ---------- Палитры градиентов и покраска вершин ---------- */
    var PRESETS = {
      mint: ['#F2FFF8', '#8CE8BE', '#1FA87A'], lime: ['#F6FFD2', '#CBF36A', '#4FB043'],
      saffron: ['#FFE6C2', '#FF9A3D', '#E5532F'], emerald: ['#7BE5B8', '#127A59', '#06382A'],
      ivory: ['#FFFFFF', '#EAF3EC', '#A9C8B6'], hero: ['#E4FF96', '#2FBF8D', '#0A4A38'],
      s1: ['#F2FFF8', '#B4F0D3', '#5FD8A6'], s2: ['#CFF7E2', '#5FD8A6', '#127A59'],
      s3: ['#7BE5B8', '#1FA87A', '#0A3A2B'], s4: ['#4FD3A0', '#127A59', '#04150F']
    };
    function stops(n) { return (PRESETS[n] || PRESETS.mint).map(function (h) { return new THREE.Color(h); }); }
    function paint(geo, st, dir) {
      var p = geo.attributes.position, n = p.count, d = new Float32Array(n), mn = 1e9, mx = -1e9, i;
      var L = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      for (i = 0; i < n; i++) {
        d[i] = (p.getX(i) * dir[0] + p.getY(i) * dir[1] + p.getZ(i) * dir[2]) / L;
        if (d[i] < mn) mn = d[i]; if (d[i] > mx) mx = d[i];
      }
      var col = new Float32Array(n * 3), c = new THREE.Color(), k = st.length - 1;
      for (i = 0; i < n; i++) {
        var t = (d[i] - mn) / ((mx - mn) || 1), s = t * k, a = Math.min(k - 1, Math.floor(s)), f = s - a;
        c.lerpColors(st[a], st[a + 1], f * f * (3 - 2 * f));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return geo;
    }
    function mat(o) {
      return new THREE.MeshPhysicalMaterial(Object.assign({ vertexColors: true, roughness: .2, metalness: 0, clearcoat: 1, clearcoatRoughness: .07, envMapIntensity: 1.15 }, o || {}));
    }

    /* ---------- Формы (габарит ≈ 1 условная единица) ---------- */
    function ring(g) { return new THREE.Mesh(paint(new THREE.TorusGeometry(.34, .14, 56, 128), stops(g), [1, .9, 0]), mat()); }
    function orb(g) { return new THREE.Mesh(paint(new THREE.SphereGeometry(.5, 72, 56), stops(g), [.35, 1, .25]), mat()); }
    function pill(g) {
      var geo = new THREE.CapsuleGeometry(.2, .6, 28, 56); geo.rotateZ(Math.PI / 2);
      return new THREE.Mesh(paint(geo, stops(g), [1, .35, 0]), mat());
    }
    function knot(g) { return new THREE.Mesh(paint(new THREE.TorusKnotGeometry(.27, .1, 220, 36, 2, 3), stops(g), [1, .9, .3]), mat()); }
    /* «подушка»: суперэллипсоид с аналитическими нормалями — гладкий скруглённый куб без швов */
    function squircle(g, sx, sy, sz, n, st) {
      var geo = new THREE.SphereGeometry(.5, 72, 56), p = geo.attributes.position, nr = geo.attributes.normal, v = new THREE.Vector3();
      for (var i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).normalize();
        var k = Math.pow(Math.pow(Math.abs(v.x), n) + Math.pow(Math.abs(v.y), n) + Math.pow(Math.abs(v.z), n), 1 / n);
        v.multiplyScalar(.5 / k);
        var ux = v.x / .5, uy = v.y / .5, uz = v.z / .5;
        var nx = Math.sign(ux) * Math.pow(Math.abs(ux), n - 1) / sx, ny = Math.sign(uy) * Math.pow(Math.abs(uy), n - 1) / sy, nz = Math.sign(uz) * Math.pow(Math.abs(uz), n - 1) / sz;
        var nl = Math.hypot(nx, ny, nz) || 1;
        nr.setXYZ(i, nx / nl, ny / nl, nz / nl);
        p.setXYZ(i, v.x * sx, v.y * sy, v.z * sz);
      }
      geo.computeBoundingSphere();
      return new THREE.Mesh(paint(geo, st || stops(g), [.8, 1, .3]), mat());
    }
    function pillow(g) { return squircle(g, .86, .86, .5, 5); }
    function stairs() {
      var grp = new THREE.Group(), hs = [.32, .52, .72, .98], names = ['s1', 's2', 's3', 's4'];
      hs.forEach(function (h, i) {
        var m = squircle(null, .21, h, .34, 5, stops(names[i]));
        m.position.set(-.33 + i * .22, -.5 + h / 2, 0); grp.add(m);
      });
      return grp;
    }
    /* монеты ₽ / ₹: боковая грань — Lathe, лицо — CanvasTexture с нарисованным знаком */
    function coinFace(kind, name) {
      var cv = document.createElement('canvas'); cv.width = cv.height = 512;
      var x = cv.getContext('2d'), pr = PRESETS[name] || PRESETS.mint;
      var gr = x.createRadialGradient(170, 150, 20, 256, 256, 330);
      gr.addColorStop(0, pr[0]); gr.addColorStop(.5, pr[1]); gr.addColorStop(1, pr[2]);
      x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
      x.lineWidth = 10; x.strokeStyle = 'rgba(255,255,255,.55)'; x.beginPath(); x.arc(256, 256, 236, 0, 7); x.stroke();
      x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,.22)'; x.beginPath(); x.arc(256, 256, 208, 0, 7); x.stroke();
      function glyph(dx, dy, color) {
        x.save(); x.translate(dx, dy - 10); x.strokeStyle = color; x.lineWidth = 38; x.lineCap = 'butt'; x.lineJoin = 'miter';
        if (kind === 'rub') {
          x.beginPath(); x.moveTo(196, 388); x.lineTo(196, 140); x.lineTo(290, 140); x.arc(290, 214, 74, -Math.PI / 2, Math.PI / 2); x.lineTo(196, 288); x.stroke();
          x.beginPath(); x.moveTo(150, 336); x.lineTo(320, 336); x.stroke();
        } else {
          x.beginPath(); x.moveTo(168, 146); x.lineTo(352, 146); x.stroke();
          x.beginPath(); x.moveTo(168, 214); x.lineTo(352, 214); x.stroke();
          x.beginPath(); x.moveTo(182, 146); x.lineTo(238, 146); x.arc(238, 212, 66, -Math.PI / 2, Math.PI / 2); x.lineTo(188, 278); x.lineTo(322, 392); x.stroke();
        }
        x.restore();
      }
      var dark = name === 'ivory';
      glyph(6, 8, dark ? 'rgba(10,58,43,.25)' : 'rgba(0,0,0,.35)');
      glyph(0, 0, dark ? '#0F6B4F' : '#F2FFF8');
      var tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      return tex;
    }
    function coin(g, kind) {
      var grp = new THREE.Group(), prof = [[0, .08], [.4, .08], [.47, .065], [.5, .03], [.5, -.03], [.47, -.065], [.4, -.08], [0, -.08]]
        .map(function (a) { return new THREE.Vector2(a[0], a[1]); });
      var geo = new THREE.LatheGeometry(prof, 96); geo.rotateX(Math.PI / 2);
      grp.add(new THREE.Mesh(paint(geo, stops(g), [.6, 1, 1]), mat({ metalness: .55, roughness: .3 })));
      var tex = coinFace(kind, g), fm = new THREE.MeshPhysicalMaterial({ map: tex, roughness: .3, metalness: .2, clearcoat: .8, clearcoatRoughness: .1, envMapIntensity: 1 });
      var f = new THREE.Mesh(new THREE.CircleGeometry(.405, 80), fm); f.position.z = .0806; grp.add(f);
      var b = new THREE.Mesh(new THREE.CircleGeometry(.405, 80), fm); b.position.z = -.0806; b.rotation.y = Math.PI; grp.add(b);
      return grp;
    }

    /* контактная тень под предметами на светлых панелях */
    var shadowTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
      var g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(2,28,18,.6)'); g.addColorStop(1, 'rgba(2,28,18,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
    })();

    /* ---------- Сборка якорей ---------- */
    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    if (!reduce) addEventListener('pointermove', function (e) { mouse.tx = e.clientX / innerWidth * 2 - 1; mouse.ty = 1 - e.clientY / innerHeight * 2; }, { passive: true });
    var D = Math.PI / 180, recs = [];

    function clusterKids(grp) {
      var defs = [
        { m: ring('hero'), s: .98, p: [0, .02, 0], r: [1.0, .3, .1], sp: [.05, .22, .04], par: 1, fl: .7, ph: 0 },
        { m: orb('saffron'), s: .38, p: [.3, .27, .22], r: [0, 0, 0], sp: [.1, .2, 0], par: 2, fl: .9, ph: 1.3 },
        { m: pill('mint'), s: .58, p: [-.3, -.3, .12], r: [0, .3, .55], sp: [.05, .15, .02], par: 1.6, fl: .8, ph: 2.1 },
        { m: pillow('lime'), s: .27, p: [.31, -.27, .25], r: [.5, .6, .3], sp: [.2, .3, .1], par: 2.2, fl: 1, ph: .6 },
        { m: orb('ivory'), s: .14, p: [-.34, .3, .12], r: [0, 0, 0], sp: [0, .1, 0], par: 2.6, fl: 1.1, ph: 3 },
        { m: ring('saffron'), s: .27, p: [.04, .41, .06], r: [1.2, .2, .4], sp: [.3, .1, .2], par: 1.4, fl: .6, ph: 4 },
        { m: orb('emerald'), s: .1, p: [-.05, -.43, .2], r: [0, 0, 0], sp: [0, .1, 0], par: 2.4, fl: 1.2, ph: 5 },
        { m: orb('lime'), s: .07, p: [.44, .02, .1], r: [0, 0, 0], sp: [0, .1, 0], par: 2.8, fl: 1.3, ph: 2.6 }
      ];
      defs.forEach(function (d) { d.m.scale.setScalar(d.s); grp.add(d.m); });
      return defs;
    }

    nodes.forEach(function (el, idx) {
      var type = el.dataset['3d'], g = el.dataset.g || 'mint';
      var root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      var tl = (el.dataset.tilt || '0,0,0').split(',').map(function (v) { return (+v) * D; });
      var rec = { el: el, root: root, body: body, tl: tl, par: +el.dataset.par || 1, t0: null, delay: type === 'cluster' ? .45 : 0, ph: idx * 1.7, swing: type === 'coin', sr: 1.2 };
      if (type === 'cluster') rec.kids = clusterKids(body);
      else if (type === 'ring') body.add(ring(g));
      else if (type === 'orb') body.add(orb(g));
      else if (type === 'pill') body.add(pill(g));
      else if (type === 'knot') body.add(knot(g));
      else if (type === 'pillow') body.add(pillow(g));
      else if (type === 'stairs') body.add(stairs());
      else if (type === 'coin') body.add(coin(g, el.dataset.glyph));
      if (el.dataset.shadow === '1') {
        var sh = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false, opacity: .5 }));
        sh.scale.set(1, .26, 1); sh.position.set(0, -.62, -.4); root.add(sh);
      }
      root.visible = false; scene.add(root); recs.push(rec);
    });

    var easeOutBack = function (p) { var c1 = 1.5, c3 = c1 + 1, q = p - 1; return 1 + c3 * q * q * q + c1 * q * q; };

    function updateRec(rec, t, sp) {
      var k = reduce ? 0 : 1, b = rec.body, tl = rec.tl;
      if (rec.kids) {
        b.rotation.set(0, mouse.x * .18 * k, 0);
        rec.kids.forEach(function (d) {
          var m = d.m;
          m.position.set(d.p[0] + mouse.x * .05 * d.par * k, d.p[1] + mouse.y * .05 * d.par * k + Math.sin(t * d.fl + d.ph) * .02 * k - sp * .07 * d.par, d.p[2]);
          m.rotation.set(d.r[0] + t * d.sp[0] * k + sp * .9 * d.par * .5, d.r[1] + t * d.sp[1] * k, d.r[2] + t * d.sp[2] * k);
        });
        return;
      }
      b.rotation.x = tl[0] + sp * rec.sr * .8 + mouse.y * .28 * rec.par * k + Math.sin(t * .6 + rec.ph) * .07 * k;
      b.rotation.y = tl[1] + (rec.swing ? Math.sin(t * .7 + rec.ph) * .5 * k : t * .32 * k) + sp * rec.sr * 1.2 + mouse.x * .4 * rec.par * k;
      b.rotation.z = tl[2];
      b.position.y = Math.sin(t * .9 + rec.ph) * .025 * k;
    }

    function draw(t) {
      for (var i = 0; i < recs.length; i++) {
        var rec = recs[i], r = rec.el.getBoundingClientRect();
        var vis = r.width > 0 && r.bottom > -H * .3 && r.top < H * 1.3;
        rec.root.visible = vis; if (!vis) continue;
        if (rec.t0 === null && r.top < H * .92 && r.bottom > 0) rec.t0 = t;
        var e = 0;
        if (rec.t0 !== null) e = reduce ? 1 : easeOutBack(Math.max(0, Math.min(1, (t - rec.t0 - rec.delay) / 1.1)));
        if (e <= 0) { rec.root.visible = false; continue; }
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2, size = Math.min(r.width, r.height);
        rec.root.position.set(cx - W / 2, H / 2 - cy, 0);
        rec.root.scale.setScalar(Math.max(.0001, size * e));
        updateRec(rec, t, (cy - H / 2) / H);
      }
      renderer.render(scene, camera);
    }

    var t0 = performance.now(), first = true;
    function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden) return;
      mouse.x += (mouse.tx - mouse.x) * .05; mouse.y += (mouse.ty - mouse.y) * .05;
      draw((now - t0) / 1000);
      if (first) { first = false; document.documentElement.classList.add('gl-on'); }
    }
    var pending = false;
    function once() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; draw(0); if (first) { first = false; document.documentElement.classList.add('gl-on'); } }); }

    addEventListener('resize', function () { resize(); if (reduce) once(); });
    if (reduce) {
      addEventListener('scroll', once, { passive: true });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(once);
      once();
    } else requestAnimationFrame(frame);
  }
})();
