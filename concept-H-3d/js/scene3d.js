/* 3D-слой: один WebGL-холст поверх страницы. Каждый .a3d в вёрстке — «якорь»:
   предмет рисуется в его прямоугольнике, едет со скроллом, вращается от скролла и курсора.
   Язык форм (референсы Mobbin: Revolut, Slash, Stripe, Phantom): тонкие металлические монеты ₽/₹,
   шёлковая лента с переливом, сцепленные звенья, металлическая карта, ступени-слитки.
   Three.js грузится лениво; без WebGL остаются CSS-градиентные заглушки (.a3d::before). */
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
    renderer.toneMappingExposure = 1.0;

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

    /* ---------- Окружение студийного света: тёмный купол + яркие «софтбоксы» — металлу нужен контраст ---------- */
    function makeEnv() {
      var es = new THREE.Scene();
      var g = new THREE.SphereGeometry(60, 48, 24), p = g.attributes.position;
      var col = new Float32Array(p.count * 3), c = new THREE.Color();
      var top = new THREE.Color('#BFEFD9').multiplyScalar(1.0), mid = new THREE.Color('#0B5740'), bot = new THREE.Color('#010806');
      for (var i = 0; i < p.count; i++) {
        var t = (p.getY(i) / 60 + 1) / 2;
        if (t > .5) c.copy(mid).lerp(top, Math.pow((t - .5) * 2, 1.6)); else c.copy(bot).lerp(mid, t * 2);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      es.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      function box(color, k, w, h, x, y, z) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
      }
      box('#ffffff', 14, 38, 22, -26, 36, 26);
      box('#FFC27F', 10, 9, 46, 42, 6, 10);
      box('#8CE8BE', 7, 7, 34, -42, -6, 16);
      box('#ffffff', 5, 60, 5, 0, -28, 30);
      box('#ffffff', 9, 64, 3.5, 0, 50, -12);
      var pm = new THREE.PMREMGenerator(renderer), rt = pm.fromScene(es, .015);
      pm.dispose();
      return rt.texture;
    }
    scene.environment = makeEnv();
    var key = new THREE.DirectionalLight(0xffffff, .9); key.position.set(-300, 420, 600); scene.add(key);
    var rim = new THREE.DirectionalLight(0xFFB070, .8); rim.position.set(520, -120, -240); scene.add(rim);

    /* ---------- Тона металла: градиент по предмету (вершинные цвета) ---------- */
    var PRESETS = {
      gold: ['#FFF3CF', '#E9B652', '#8B5518'], brass: ['#F7DFA0', '#C98B35', '#5E3510'],
      silver: ['#FFFFFF', '#CBD8D1', '#6F877B'], emerald: ['#A8F2D2', '#14835E', '#052E22'],
      forest: ['#45C497', '#0D5B43', '#03170F'], copper: ['#FFD4AB', '#F0894A', '#9A3E18'],
      mint: ['#EFFFF7', '#9FE6C6', '#2BA77D'], lime: ['#F6FFD2', '#CBF36A', '#4FB043'],
      saffron: ['#FFE6C2', '#FF9A3D', '#E5532F'], ivory: ['#FFFFFF', '#EAF3EC', '#A9C8B6'],
      s1: ['#EFFFF7', '#A7EBCB', '#4FCB9C'], s2: ['#BEF2DB', '#4FCB9C', '#14835E'],
      s3: ['#6ADAB0', '#1A9168', '#06402F'], s4: ['#2FB88A', '#0D5B43', '#03170F']
    };
    function stops(n) { return (PRESETS[n] || PRESETS.gold).map(function (h) { return new THREE.Color(h); }); }
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
    function metal(o) {
      return new THREE.MeshPhysicalMaterial(Object.assign({ vertexColors: true, metalness: .9, roughness: .24, clearcoat: .55, clearcoatRoughness: .18, envMapIntensity: 1.55 }, o || {}));
    }

    /* ---------- Формы (габарит ≈ 1 условная единица) ---------- */
    /* монета: скошенный обод (Lathe) + лицо с выгравированным знаком ₽ / ₹ */
    var FACE = {
      gold: ['#FFF0C4', '#DDA547', '#8B5518', '#6E4010', 'rgba(255,248,225,.9)'],
      silver: ['#FFFFFF', '#CBD8D1', '#8CA397', '#3E564B', 'rgba(255,255,255,.95)'],
      emerald: ['#2CB587', '#0F6B4F', '#052E22', '#C8F8E1', 'rgba(8,60,44,.8)'],
      forest: ['#1F8F6C', '#0A4A37', '#021710', '#A8F0D2', 'rgba(5,40,30,.8)']
    };
    function coinFace(kind, tone) {
      var f = FACE[tone] || FACE.gold;
      var cv = document.createElement('canvas'); cv.width = cv.height = 512;
      var x = cv.getContext('2d');
      var gr = x.createRadialGradient(160, 140, 20, 256, 256, 340);
      gr.addColorStop(0, f[0]); gr.addColorStop(.55, f[1]); gr.addColorStop(1, f[2]);
      x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
      /* рифлёный кант и канавки */
      x.strokeStyle = f[4]; x.lineWidth = 6; x.beginPath(); x.arc(256, 256, 238, 0, 7); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 3; x.beginPath(); x.arc(256, 256, 222, 0, 7); x.stroke();
      x.strokeStyle = f[4]; x.globalAlpha = .45; x.lineWidth = 2; x.beginPath(); x.arc(256, 256, 196, 0, 7); x.stroke(); x.globalAlpha = 1;
      for (var k = 0; k < 96; k++) {
        var a = k / 96 * 6.2832; x.strokeStyle = 'rgba(0,0,0,.16)'; x.lineWidth = 3;
        x.beginPath(); x.moveTo(256 + Math.cos(a) * 241, 256 + Math.sin(a) * 241); x.lineTo(256 + Math.cos(a) * 250, 256 + Math.sin(a) * 250); x.stroke();
      }
      function glyph(dx, dy, color) {
        x.save(); x.translate(dx, dy - 8); x.strokeStyle = color; x.lineWidth = 34; x.lineCap = 'butt'; x.lineJoin = 'miter';
        if (kind === 'rub') {
          x.beginPath(); x.moveTo(196, 388); x.lineTo(196, 140); x.lineTo(290, 140); x.arc(290, 214, 74, -Math.PI / 2, Math.PI / 2); x.lineTo(196, 288); x.stroke();
          x.beginPath(); x.moveTo(150, 336); x.lineTo(320, 336); x.stroke();
        } else if (kind === 'inr') {
          x.beginPath(); x.moveTo(168, 146); x.lineTo(352, 146); x.stroke();
          x.beginPath(); x.moveTo(168, 214); x.lineTo(352, 214); x.stroke();
          x.beginPath(); x.moveTo(182, 146); x.lineTo(238, 146); x.arc(238, 212, 66, -Math.PI / 2, Math.PI / 2); x.lineTo(188, 278); x.lineTo(322, 392); x.stroke();
        } else {
          x.beginPath(); x.arc(256, 256, 70, 0, 7); x.stroke();
        }
        x.restore();
      }
      glyph(5, 7, 'rgba(0,0,0,.4)');      /* тень гравировки */
      glyph(-2, -2, f[4]);                 /* блик на кромке */
      glyph(0, 0, f[3]);                   /* сам знак */
      var tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      return tex;
    }
    function coin(tone, kind) {
      var grp = new THREE.Group();
      var prof = [[0, .045], [.43, .045], [.47, .036], [.5, .014], [.5, -.014], [.47, -.036], [.43, -.045], [0, -.045]]
        .map(function (a) { return new THREE.Vector2(a[0], a[1]); });
      var geo = new THREE.LatheGeometry(prof, 120); geo.rotateX(Math.PI / 2);
      var rimT = { gold: 'gold', silver: 'silver', emerald: 'silver', forest: 'gold' }[tone] || 'gold';
      grp.add(new THREE.Mesh(paint(geo, stops(rimT), [.5, 1, 1]), metal({ roughness: .2, envMapIntensity: 1.7 })));
      var tex = coinFace(kind, tone), fm = new THREE.MeshPhysicalMaterial({ map: tex, metalness: .5, roughness: .34, clearcoat: .6, clearcoatRoughness: .2, envMapIntensity: 1.35 });
      var fr = new THREE.Mesh(new THREE.CircleGeometry(.44, 96), fm); fr.position.z = .0456; grp.add(fr);
      var bk = new THREE.Mesh(new THREE.CircleGeometry(.44, 96), fm); bk.position.z = -.0456; bk.rotation.y = Math.PI; grp.add(bk);
      return grp;
    }
    /* шёлковая лента с переливом: поверхность по кривой, ширина и скрутка меняются вдоль неё */
    function ribbon(tone) {
      var L = 260, Wn = 18, pos = [], idx = [], i, j, up = new THREE.Vector3(0, 1, 0);
      function C(t) { return new THREE.Vector3((t - .5) * 2.4, Math.sin(t * 6.1) * .2 + Math.sin(t * 2.2) * .14, Math.cos(t * 4.3) * .3); }
      for (i = 0; i <= L; i++) {
        var t = i / L, c = C(t), T = C(Math.min(1, t + .003)).sub(C(Math.max(0, t - .003))).normalize();
        var B = new THREE.Vector3().crossVectors(T, up).normalize(), N = new THREE.Vector3().crossVectors(B, T);
        var a = t * Math.PI * 2.7 + Math.sin(t * 5) * .5;
        var S = B.multiplyScalar(Math.cos(a)).add(N.multiplyScalar(Math.sin(a)));
        var w = .36 + .3 * Math.pow(Math.sin(t * Math.PI * 2.6 + 1), 2);
        for (j = 0; j <= Wn; j++) { var s = (j / Wn - .5) * w; pos.push(c.x + S.x * s, c.y + S.y * s, c.z + S.z * s); }
      }
      for (i = 0; i < L; i++) for (j = 0; j < Wn; j++) { var a0 = i * (Wn + 1) + j, b0 = a0 + 1, c0 = a0 + Wn + 1, d0 = c0 + 1; idx.push(a0, c0, b0, b0, c0, d0); }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3)); geo.setIndex(idx); geo.computeVertexNormals();
      paint(geo, stops(tone || 'emerald').concat([new THREE.Color('#F2C46B')]).slice(0, 4), [1, .25, 0]);
      var m = new THREE.Mesh(geo, metal({ side: THREE.DoubleSide, metalness: .55, roughness: .22, iridescence: .9, iridescenceIOR: 1.5, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 520, clearcoat: .8 }));
      m.scale.setScalar(.5); return m;
    }
    /* два сцепленных звена: изумруд + золото — «Россия + Индия» */
    function links() {
      var g = new THREE.Group();
      var A = new THREE.Mesh(paint(new THREE.TorusGeometry(.27, .068, 48, 128), stops('emerald'), [1, .8, 0]), metal({ roughness: .2 }));
      A.position.x = -.13;
      var Bm = new THREE.Mesh(paint(new THREE.TorusGeometry(.27, .068, 48, 128), stops('gold'), [1, 0, .8]), metal({ roughness: .2 }));
      Bm.rotation.x = Math.PI / 2; Bm.position.x = .13;
      g.add(A); g.add(Bm); g.scale.setScalar(1.25); return g;
    }
    function knot(tone) { return new THREE.Mesh(paint(new THREE.TorusKnotGeometry(.27, .085, 240, 40, 2, 3), stops(tone || 'gold'), [1, .9, .3]), metal({ roughness: .2 })); }
    /* металлическая карта с чипом */
    function plate() {
      var g = new THREE.Group(), w = .9, h = .57, r = .06, sh = new THREE.Shape();
      sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
      sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
      var geo = new THREE.ExtrudeGeometry(sh, { depth: .02, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 4, curveSegments: 20 });
      geo.translate(0, 0, -.01);
      g.add(new THREE.Mesh(paint(geo, stops('emerald'), [.9, .8, 0]), metal({ roughness: .22 })));
      var cv = document.createElement('canvas'); cv.width = 512; cv.height = 326; var x = cv.getContext('2d');
      var cg = x.createLinearGradient(60, 90, 150, 170); cg.addColorStop(0, '#FFF1C4'); cg.addColorStop(1, '#C48A2C');
      x.fillStyle = cg; x.beginPath(); x.roundRect(54, 100, 84, 64, 12); x.fill();
      x.strokeStyle = 'rgba(80,45,8,.55)'; x.lineWidth = 3; x.beginPath(); x.moveTo(96, 100); x.lineTo(96, 164); x.moveTo(54, 132); x.lineTo(138, 132); x.stroke();
      x.fillStyle = 'rgba(230,255,244,.92)'; x.font = '600 38px Onest, Arial'; x.fillText('RU · IN', 54, 270);
      x.strokeStyle = 'rgba(230,255,244,.4)'; x.lineWidth = 3; x.beginPath(); x.arc(420, 70, 28, 0, 7); x.arc(450, 70, 28, 0, 7); x.stroke();
      var tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      var face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
      face.position.z = .0225; g.add(face); return g;
    }
    function pearl(tone, r) {
      return new THREE.Mesh(paint(new THREE.SphereGeometry(r, 48, 36), stops(tone), [.3, 1, .4]), metal({ metalness: .6, roughness: .16, clearcoat: 1, clearcoatRoughness: .05, iridescence: .6 }));
    }
    /* «подушка» (скруглённый брусок) с аналитическими нормалями — для ступеней-слитков */
    function squircle(sx, sy, sz, n, st) {
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
      return new THREE.Mesh(paint(geo, st, [.8, 1, .3]), metal({ roughness: .22 }));
    }
    function stairs() {
      var grp = new THREE.Group(), hs = [.32, .52, .72, .98], names = ['s1', 's2', 's3', 's4'];
      hs.forEach(function (h, i) {
        var m = squircle(.21, h, .34, 6, stops(names[i]));
        m.position.set(-.33 + i * .22, -.5 + h / 2, 0); grp.add(m);
      });
      return grp;
    }
    /* веер монет — центральная композиция hero (как у Revolut) */
    function fan() {
      var grp = new THREE.Group(), tones = ['emerald', 'gold', 'silver', 'forest', 'gold', 'emerald', 'silver'], kinds = ['rub', 'inr', 'rub', 'inr', 'rub', 'inr', 'rub'];
      for (var i = 0; i < 7; i++) { var c = coin(tones[i], kinds[i]); c.scale.setScalar(.5); c.userData.u = i / 6 - .5; c.userData.i = i; grp.add(c); }
      return grp;
    }
    function fanAnimate(grp, t, sp, mx, k) {
      grp.children.forEach(function (c) {
        var u = c.userData.u, i = c.userData.i;
        c.position.set(u * 1.25 + mx * .03 * k, .12 - u * u * .55 + Math.sin(t * .8 + i) * .018 * k, -Math.abs(u) * .3);
        c.rotation.set(-.16 + Math.sin(t * .5 + i * .7) * .06 * k, u * 2.25 + Math.sin(t * .6 + i) * .12 * k + sp * .8 + mx * .25 * k, -u * .4);
      });
    }

    /* контактная тень под предметами на светлых панелях */
    var shadowTex = (function () {
      var c = document.createElement('canvas'); c.width = c.height = 128; var x = c.getContext('2d');
      var g = x.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, 'rgba(2,28,18,.55)'); g.addColorStop(1, 'rgba(2,28,18,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
    })();

    /* ---------- Сборка якорей ---------- */
    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    if (!reduce) addEventListener('pointermove', function (e) { mouse.tx = e.clientX / innerWidth * 2 - 1; mouse.ty = 1 - e.clientY / innerHeight * 2; }, { passive: true });
    var D = Math.PI / 180, recs = [];

    function clusterKids(grp) {
      var defs = [
        { m: ribbon('emerald'), s: 1.02, p: [0, .02, -.4], r: [.15, 0, -.1], sp: [0, .03, 0], par: .6, fl: .5, ph: 0, rib: 1 },
        { m: fan(), s: .74, p: [0, -.02, 0], r: [0, 0, 0], sp: [0, 0, 0], par: 1, fan: 1 },
        { m: pearl('silver', .5), s: .1, p: [-.42, .3, .1], r: [0, 0, 0], sp: [0, .1, 0], par: 2.4, fl: 1.1, ph: 3 },
        { m: pearl('gold', .5), s: .07, p: [.4, -.33, .15], r: [0, 0, 0], sp: [0, .1, 0], par: 2.6, fl: 1.2, ph: 1.4 },
        { m: pearl('emerald', .5), s: .05, p: [.34, .36, .05], r: [0, 0, 0], sp: [0, .1, 0], par: 2.8, fl: 1.3, ph: 2.6 }
      ];
      defs.forEach(function (d) { d.m.scale.multiplyScalar(d.s); grp.add(d.m); });
      return defs;
    }

    nodes.forEach(function (el, idx) {
      var type = el.dataset['3d'], g = el.dataset.g || 'gold';
      var root = new THREE.Group(), body = new THREE.Group(); root.add(body);
      var tl = (el.dataset.tilt || '0,0,0').split(',').map(function (v) { return (+v) * D; });
      var rec = { el: el, root: root, body: body, tl: tl, par: +el.dataset.par || 1, t0: null, delay: type === 'cluster' ? .45 : 0, ph: idx * 1.7, swing: type === 'coin' || type === 'plate' || type === 'ribbon', sr: 1.2 };
      if (type === 'cluster') rec.kids = clusterKids(body);
      else if (type === 'coin') body.add(coin(g, el.dataset.glyph));
      else if (type === 'ribbon') body.add(ribbon(g));
      else if (type === 'links') body.add(links());
      else if (type === 'plate') body.add(plate());
      else if (type === 'knot') body.add(knot(g));
      else if (type === 'stairs') body.add(stairs());
      if (el.dataset.shadow === '1') {
        var sh = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, toneMapped: false, opacity: .5 }));
        sh.scale.set(1, .26, 1); sh.position.set(0, -.62, -.4); root.add(sh);
      }
      root.visible = false; scene.add(root); recs.push(rec);
    });

    var easeOutBack = function (p) { var c1 = 1.2, c3 = c1 + 1, q = p - 1; return 1 + c3 * q * q * q + c1 * q * q; };

    function updateRec(rec, t, sp) {
      var k = reduce ? 0 : 1, b = rec.body, tl = rec.tl;
      if (rec.kids) {
        b.rotation.set(0, mouse.x * .12 * k, 0);
        rec.kids.forEach(function (d) {
          var m = d.m;
          if (d.fan) { fanAnimate(m, t, sp, mouse.x, k); m.position.set(d.p[0], d.p[1] + mouse.y * .03 * k - sp * .05, d.p[2]); return; }
          m.position.set(d.p[0] + mouse.x * .05 * d.par * k, d.p[1] + mouse.y * .05 * d.par * k + Math.sin(t * d.fl + d.ph) * .02 * k - sp * .07 * d.par, d.p[2]);
          if (d.rib) m.rotation.set(d.r[0] + Math.sin(t * .4) * .08 * k + sp * .5, d.r[1] + Math.sin(t * .3) * .25 * k + mouse.x * .2 * k, d.r[2] + Math.sin(t * .35) * .06 * k);
          else m.rotation.set(d.r[0] + t * d.sp[0] * k, d.r[1] + t * d.sp[1] * k, d.r[2] + t * d.sp[2] * k);
        });
        return;
      }
      b.rotation.x = tl[0] + sp * rec.sr * .7 + mouse.y * .22 * rec.par * k + Math.sin(t * .6 + rec.ph) * .06 * k;
      b.rotation.y = tl[1] + (rec.swing ? Math.sin(t * .7 + rec.ph) * .45 * k : t * .28 * k) + sp * rec.sr * 1 + mouse.x * .32 * rec.par * k;
      b.rotation.z = tl[2];
      b.position.y = Math.sin(t * .9 + rec.ph) * .022 * k;
    }

    function draw(t) {
      for (var i = 0; i < recs.length; i++) {
        var rec = recs[i], r = rec.el.getBoundingClientRect();
        var vis = r.width > 0 && r.bottom > -H * .3 && r.top < H * 1.3;
        rec.root.visible = vis; if (!vis) continue;
        if (rec.t0 === null && r.top < H * .92 && r.bottom > 0) rec.t0 = t;
        var e = 0;
        if (rec.t0 !== null) e = reduce ? 1 : easeOutBack(Math.max(0, Math.min(1, (t - rec.t0 - rec.delay) / 1.2)));
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
