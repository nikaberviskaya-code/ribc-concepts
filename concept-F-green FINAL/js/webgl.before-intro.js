/* three.js (~1 МБ) грузится лениво: hero — в простое после load, глобус — когда до него остаётся ~800 px */
let THREE;
const getThree = () => THREE ? Promise.resolve(THREE) : new Promise((res, rej) => {
  if (window.THREE) return res((THREE = window.THREE));
  const s = document.createElement('script'); s.src = 'vendor/three.iife.js';
  s.onload = () => res((THREE = window.THREE)); s.onerror = rej; document.head.appendChild(s);
});

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const dpr = () => Math.min(window.devicePixelRatio || 1, 1.75);
const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
addEventListener('pointermove', e => { mouse.tx = e.clientX / innerWidth; mouse.ty = 1 - e.clientY / innerHeight; }, { passive: true });

/* общий цикл: рисуем только то, что сейчас на экране */
const jobs = [];
function register(el, draw) {
  const job = { el, draw, visible: !reduce ? false : true };
  new IntersectionObserver(([en]) => { job.visible = en.isIntersecting; }, { rootMargin: '120px' }).observe(el);
  jobs.push(job); return job;
}
let t0 = performance.now(), loopOn = false;
function loop(now) {
  const t = (now - t0) / 1000;
  mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
  if (!document.hidden) for (const j of jobs) if (j.visible) j.draw(t);
  requestAnimationFrame(loop);
}

/* ------------------ Hero: нити между Москвой и Нью-Дели ------------------ */
const small0 = matchMedia('(max-width: 640px)').matches;
function initHero() {
  const host = document.getElementById('heroGl');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: !small0, alpha: true, powerPreference: 'high-performance' }); }
  catch (e) { return; }
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  document.documentElement.classList.add('gl-on');
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* пучок нитей: каждая — LineSegments, форма считается в вершинном шейдере */
  const small = matchMedia('(max-width: 640px)').matches;
  const THREADS = small ? 70 : 130, SEG = 110, nV = THREADS * SEG * 2;
  const aT = new Float32Array(nV), aSeed = new Float32Array(nV), pos = new Float32Array(nV * 3);
  let k = 0;
  for (let i = 0; i < THREADS; i++) for (let s = 0; s < SEG; s++) {
    aT[k] = s / SEG; aSeed[k++] = (i + .5) / THREADS;
    aT[k] = (s + 1) / SEG; aSeed[k++] = (i + .5) / THREADS;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  g.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));

  const uniforms = { uTime: { value: 0 }, uAsp: { value: 1.6 }, uMouse: { value: new THREE.Vector2(9, 9) }, uPx: { value: 1 } };
  const ENDS = `vec2 A = vec2(-.90 * uAsp, .06), B = vec2(.88 * uAsp, uAsp < 1. ? .30 : .44);`;

  const threadMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aT; attribute float aSeed;
      uniform float uTime, uAsp; uniform vec2 uMouse;
      varying float vA, vT, vHot;
      float h(float n){ return fract(sin(n * 127.1 + 3.7) * 43758.5453); }
      void main(){
        float t = aT, s = aSeed;
        ${ENDS}
        vec2 dir = normalize(B - A), nrm = vec2(-dir.y, dir.x);
        float env = pow(sin(3.14159265 * t), 1.15);
        float spread = h(s * 91.7) - .5;
        /* на узких (мобильных) экранах нити спокойнее: меньше размах и меньше изгибов */
        float k = smoothstep(.5, 1.25, uAsp);
        float amp = (.10 + .34 * h(s * 3.7)) * mix(.34, 1., k);
        float sp = 1. + h(s * 7.1) * mix(.8, 1.8, k);
        float ph = h(s * 13.3) * 6.2831;
        float wave = sin(t * sp * 6.2831 + uTime * (.12 + .25 * h(s * 5.3)) + ph);
        vec2 p = mix(A, B, t) + nrm * (spread * 1.1 + wave * .55) * amp * env;
        p.y += .07 * sin(3.14159265 * t);
        vec2 d = p - uMouse; float md = length(d);
        gl_Position = vec4(p.x / uAsp, p.y, 0., 1.);
        /* световой «пакет» бежит по каждой нити от России к Индии */
        float head = fract(uTime * (.045 + .06 * h(s * 9.1)) + h(s * 4.4));
        float dt = t - head; dt = dt - floor(dt + .5);
        float pk = exp(-dt * dt * 420.);
        float fade = smoothstep(0., .07, t) * smoothstep(1., .93, t);
        vA = fade * (.10 + .34 * h(s * 2.9) * (.5 + .5 * env)) + pk * .85 * fade;
        vT = t; vHot = pk;
      }`,
    fragmentShader: `
      precision highp float;
      varying float vA, vT, vHot;
      void main(){
        vec3 mint = vec3(.56, .95, .78), warm = vec3(1., .66, .30);
        vec3 col = mix(mint, warm, smoothstep(.35, 1., vT));
        col = mix(col, vec3(1.), vHot * .7);
        gl_FragColor = vec4(col, vA);
      }`
  });
  const threads = new THREE.LineSegments(g, threadMat); threads.frustumCulled = false; scene.add(threads);

  /* два узла-«города» на концах пучка */
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  ng.setAttribute('aEnd', new THREE.BufferAttribute(new Float32Array([0, 1]), 1));
  const nodeMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute float aEnd; uniform float uTime, uAsp, uPx; varying float vE, vP;
      void main(){
        ${ENDS}
        vec2 p = mix(A, B, aEnd);
        gl_Position = vec4(p.x / uAsp, p.y, 0., 1.);
        vP = .5 + .5 * sin(uTime * 2.2 + aEnd * 3.);
        gl_PointSize = (40. + 16. * vP) * uPx; vE = aEnd;
      }`,
    fragmentShader: `
      precision highp float; varying float vE, vP;
      void main(){
        float d = length(gl_PointCoord - .5) * 2.;
        if (d > 1.) discard;
        float core = 1. - smoothstep(0., .16, d), halo = pow(1. - clamp(d, 0., 1.), 2.) * .55;
        vec3 c = mix(vec3(.75, 1., .9), vec3(1., .66, .30), vE);
        gl_FragColor = vec4(c, core + halo * (.6 + .4 * vP));
      }`
  });
  const nodes = new THREE.Points(ng, nodeMat); nodes.frustumCulled = false; scene.add(nodes);

  function size() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setPixelRatio(dpr()); renderer.setSize(w, h, false);
    uniforms.uAsp.value = w / h; uniforms.uPx.value = renderer.getPixelRatio();
    renderer.render(scene, cam);
  }
  new ResizeObserver(size).observe(host); size();
  const draw = (t) => {
    const asp = uniforms.uAsp.value;
    uniforms.uTime.value = t;
    uniforms.uMouse.value.set((mouse.x - .5) * 2 * asp, (mouse.y - .5) * 2);
    renderer.render(scene, cam);
  };
  if (reduce) { uniforms.uTime.value = 7; renderer.render(scene, cam); }
  else register(host, draw);
  renderer.domElement.setAttribute('aria-hidden', 'true');
}

/* ------------------ Глобус: Москва ↔ Дели ------------------ */
function initGlobe() {
  const host = document.getElementById('globe');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { return; }
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(35, 1, .1, 20); cam.position.z = 4.2;
  const group = new THREE.Group(); scene.add(group);

  const ll = (lat, lon, r = 1) => {
    const φ = lat * Math.PI / 180, λ = lon * Math.PI / 180;
    return new THREE.Vector3(r * Math.cos(φ) * Math.sin(λ), r * Math.sin(φ), r * Math.cos(φ) * Math.cos(λ));
  };

  /* сфера из точек (спираль Фибоначчи) */
  const N = 2600, pos = new Float32Array(N * 3), ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), a = i * ga;
    pos.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dotMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uScale: { value: 1 } },
    vertexShader: `
      uniform float uScale; varying float vA;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.);
        vec3 n = normalize((modelMatrix * vec4(position, 0.)).xyz);
        vA = .12 + .88 * smoothstep(-.25, 1., n.z);
        gl_PointSize = (2.2 + 1.4 * vA) * uScale;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vA;
      void main(){ float d = length(gl_PointCoord - .5); if(d > .5) discard;
        gl_FragColor = vec4(mix(vec3(.45,.9,.7), vec3(1.), vA * .6), vA * (1. - smoothstep(.15, .5, d))); }`
  });
  group.add(new THREE.Points(g, dotMat));

  /* маркеры и дуги: Москва → три города проведения мероприятий */
  const moscow = ll(55.75, 37.62, 1.005);
  const mk = (v, color, r = .026) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9 }));
    m.position.copy(v); group.add(m);
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.5, r * 1.75, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .55, side: THREE.DoubleSide }));
    ring.position.copy(v); ring.lookAt(v.clone().multiplyScalar(2)); group.add(ring); return ring;
  };
  const rings = [mk(moscow, 0xffffff, .032)];
  const SEG = 72, arcs = [];
  const dests = [[28.61, 77.21, 0xff9a3d, .24], [23.22, 72.64, 0xffd08a, .17], [22.57, 88.36, 0xffb36b, .20]];
  dests.forEach(([la, lo, col, lift], i) => {
    const d = ll(la, lo, 1.005); rings.push(mk(d, col));
    const a = moscow.clone().normalize(), b = d.clone().normalize(), ang = a.angleTo(b), pts = [];
    for (let j = 0; j <= SEG; j++) {
      const s = j / SEG, k = Math.sin((1 - s) * ang) / Math.sin(ang), l = Math.sin(s * ang) / Math.sin(ang);
      pts.push(a.clone().multiplyScalar(k).add(b.clone().multiplyScalar(l)).normalize().multiplyScalar(1.005 + lift * Math.sin(Math.PI * s)));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: .8 })));
    arcs.push({ g, phase: i * .45 });
  });

  group.rotation.x = .42;
  function size() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setPixelRatio(dpr()); renderer.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    dotMat.uniforms.uScale.value = renderer.getPixelRatio();
    draw(2);
  }
  function draw(t) {
    group.rotation.y = -63 * Math.PI / 180 + Math.sin(t * .22) * .3 + (mouse.x - .5) * .3;
    group.rotation.x = .42 + (mouse.y - .5) * -.18;
    for (const a of arcs) {
      const p = reduce ? 1 : Math.min(1, (((t * .32) + a.phase) % 1.7) / 1);
      a.g.setDrawRange(0, Math.max(2, Math.floor(p * (SEG + 1))));
    }
    const s = 1 + (reduce ? 0 : .35 * (.5 + .5 * Math.sin(t * 2.4)));
    rings.forEach(r => r.scale.setScalar(s));
    renderer.render(scene, cam);
  }
  new ResizeObserver(size).observe(host); size();
  if (!reduce) register(host, draw);
}

const idle = cb => 'requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 2000 }) : setTimeout(cb, 400);
const afterLoad = cb => document.readyState === 'complete' ? idle(cb) : addEventListener('load', () => idle(cb), { once: true });
afterLoad(() => getThree().then(() => { initHero(); if (!reduce && !loopOn) { loopOn = true; requestAnimationFrame(loop); } }).catch(() => {}));

const globeHost = document.getElementById('globe');
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(([en], obs) => {
    if (!en.isIntersecting) return; obs.disconnect();
    getThree().then(() => { initGlobe(); if (!reduce && !loopOn) { loopOn = true; requestAnimationFrame(loop); } }).catch(() => {});
  }, { rootMargin: '800px 0px' });
  io.observe(globeHost);
}
