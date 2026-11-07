/* RIBC globe: dotted Earth with the Moscow -> Delhi route. Three.js r187 (classic-script build) + GSAP. */
(function () {
  var host = document.querySelector(".hero-art");
  if (!host || !window.THREE || !window.GLOBE_LAND) return;
  var T = THREE, R = 1.2;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
  catch (e) { return; } // no WebGL: the flat SVG map stays
  host.classList.add("has-globe");
  var canvas = renderer.domElement;
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  var scene = new T.Scene();
  var camera = new T.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0, 4.2);

  // lat/lon -> point on the sphere (lon 0 faces the camera, +y is north)
  function ll(lat, lon, r) {
    var a = lat * Math.PI / 180, o = lon * Math.PI / 180;
    return new T.Vector3(r * Math.cos(a) * Math.sin(o), r * Math.sin(a), r * Math.cos(a) * Math.cos(o));
  }

  var globe = new T.Group();
  scene.add(globe);

  // body: a pale sphere hides the far-side dots
  globe.add(new T.Mesh(new T.SphereGeometry(R * 0.995, 64, 48), new T.MeshBasicMaterial({ color: 0xF4F7FC })));

  // land: one Points draw call from the precomputed mask
  var bin = atob(window.GLOBE_LAND), n = bin.length / 4, pos = new Float32Array(n * 3);
  var dv = new DataView(new ArrayBuffer(bin.length));
  for (var i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
  for (var k = 0; k < n; k++) {
    var p = ll(dv.getInt16(k * 4, true) / 100, dv.getInt16(k * 4 + 2, true) / 100, R);
    pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z;
  }
  var geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  var dots = new T.Points(geo, new T.PointsMaterial({ color: 0x002664, size: 0.021, sizeAttenuation: true, transparent: true, opacity: 0.0 }));
  globe.add(dots);

  // rim light ring behind the globe
  var rim = new T.Mesh(new T.RingGeometry(R * 0.995, R * 1.012, 128), new T.MeshBasicMaterial({ color: 0x002664, transparent: true, opacity: 0.18 }));
  rim.position.z = -0.01; scene.add(rim);

  // route: great circle lifted into an arc
  var MSK = { lat: 55.75, lon: 37.62 }, DEL = { lat: 28.61, lon: 77.21 };
  var a = ll(MSK.lat, MSK.lon, 1), b = ll(DEL.lat, DEL.lon, 1), ang = a.angleTo(b), pts = [];
  for (var s = 0; s <= 96; s++) {
    var t = s / 96, sa = Math.sin((1 - t) * ang) / Math.sin(ang), sb = Math.sin(t * ang) / Math.sin(ang);
    var v = a.clone().multiplyScalar(sa).add(b.clone().multiplyScalar(sb)).normalize();
    pts.push(v.multiplyScalar(R * (1.003 + 0.2 * Math.sin(Math.PI * t))));
  }
  var curve = new T.CatmullRomCurve3(pts);
  var tube = new T.TubeGeometry(curve, 160, 0.0065, 6, false);
  var route = new T.Mesh(tube, new T.MeshBasicMaterial({ color: 0x000C1F }));
  globe.add(route);
  var total = tube.index.count; tube.setDrawRange(0, 0);

  // markers + pulse
  function marker(c, col) {
    var g = new T.Group(); g.position.copy(ll(c.lat, c.lon, R * 1.004));
    g.add(new T.Mesh(new T.SphereGeometry(0.026, 16, 12), new T.MeshBasicMaterial({ color: col })));
    var ring = new T.Mesh(new T.RingGeometry(0.04, 0.046, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, side: T.DoubleSide }));
    ring.lookAt(g.position.clone().multiplyScalar(2)); g.add(ring); g.userData.ring = ring; globe.add(g); return g;
  }
  var mMsk = marker(MSK, 0x000C1F), mDel = marker(DEL, 0x002664);
  mMsk.scale.setScalar(0); mDel.scale.setScalar(0);
  var pulse = new T.Mesh(new T.SphereGeometry(0.02, 12, 10), new T.MeshBasicMaterial({ color: 0xB45309 }));
  pulse.visible = false; globe.add(pulse);

  // HTML labels projected from 3D
  function label(text) { var el = document.createElement("span"); el.className = "glabel"; el.textContent = text; host.appendChild(el); return el; }
  var lMsk = label("МОСКВА"), lDel = label("ДЕЛИ"); lMsk.className += " l";

  // state driven by GSAP
  var st = { yaw: -0.2, tilt: 0.38, lift: -0.52, drag: 0, tx: 0, ty: 0, sway: 0, draw: 0, pulseT: 0 };
  var baseYaw = -(MSK.lon + DEL.lon) / 2 * Math.PI / 180; // centre the route

  function resize() {
    var w = host.clientWidth, h = host.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // narrow screens: pull the camera back so the cap still shows the route
    camera.position.z = w < 700 ? 4.3 : 4.2;
    st.lift = w < 700 ? -0.62 : -0.52;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host); resize();

  var tmp = new T.Vector3();
  function place(el, obj) {
    obj.getWorldPosition(tmp);
    var front = tmp.clone().normalize().dot(camera.position.clone().sub(tmp).normalize()) > 0.02;
    tmp.project(camera);
    var x = (tmp.x * 0.5 + 0.5) * host.clientWidth, y = (-tmp.y * 0.5 + 0.5) * host.clientHeight;
    el.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px)";
    el.dataset.vis = front ? "1" : "0";
  }

  function render() {
    globe.rotation.y = baseYaw + st.yaw + st.sway + st.drag;
    globe.rotation.x = st.tilt + st.ty;
    globe.position.y = st.lift;
    rim.position.y = st.lift;
    tube.setDrawRange(0, Math.floor(st.draw * total / 3) * 3);
    if (st.pulseT > 0) { pulse.visible = true; pulse.position.copy(curve.getPointAt(Math.min(st.pulseT, 1))); } else pulse.visible = false;
    mMsk.userData.ring.scale.setScalar(1 + 0.5 * ((performance.now() / 1400) % 1)); mMsk.userData.ring.material.opacity = 0.6 * (1 - ((performance.now() / 1400) % 1));
    mDel.userData.ring.scale.setScalar(1 + 0.5 * (((performance.now() + 700) / 1400) % 1)); mDel.userData.ring.material.opacity = 0.6 * (1 - (((performance.now() + 700) / 1400) % 1));
    globe.updateMatrixWorld(true);
    place(lMsk, mMsk); place(lDel, mDel);
    renderer.render(scene, camera);
  }

  // reduced motion: one still frame in the final state, no loop
  if (reduce || !window.gsap) {
    dots.material.opacity = 0.85; st.draw = 1; mMsk.scale.setScalar(1); mDel.scale.setScalar(1);
    lMsk.dataset.on = lDel.dataset.on = "1"; render();
    new ResizeObserver(render).observe(host); return;
  }

  // loop only while the hero is on screen
  var running = false, tick = function () { render(); };
  function run(on) { if (on && !running) { gsap.ticker.add(tick); running = true; } else if (!on && running) { gsap.ticker.remove(tick); running = false; } }
  if (window.ScrollTrigger) ScrollTrigger.create({ trigger: host, start: "top bottom", end: "bottom top", onToggle: function (s) { run(s.isActive); } });
  else run(true);

  // intro: dots fade in while the globe spins into place, then the route draws
  var tl = gsap.timeline({ delay: 0.9, defaults: { ease: "power3.out" } });
  tl.fromTo(st, { yaw: 2.4 }, { yaw: 0, duration: 2.6, ease: "power3.out" }, 0)
    .to(dots.material, { opacity: 0.85, duration: 1.4, ease: "power1.inOut" }, 0)
    .to(mMsk.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: "back.out(2.4)" }, 1.4)
    .to(lMsk, { duration: 0.01, onStart: function () { lMsk.dataset.on = "1"; } }, 1.5)
    .to(st, { draw: 1, duration: 1.6, ease: "power2.inOut" }, 1.7)
    .to(mDel.scale, { x: 1, y: 1, z: 1, duration: 0.5, ease: "back.out(2.4)" }, 3.2)
    .to(lDel, { duration: 0.01, onStart: function () { lDel.dataset.on = "1"; } }, 3.3)
    .add(function () {
      gsap.to(st, { pulseT: 1.0, duration: 2.8, ease: "sine.inOut", repeat: -1, repeatDelay: 1.2, onRepeat: function () { st.pulseT = 0.001; } });
      st.pulseT = 0.001;
      gsap.to(st, { sway: 0.12, duration: 7, ease: "sine.inOut", yoyo: true, repeat: -1 });
    }, 3.4);

  // scroll: the globe turns a little as the page moves
  if (window.ScrollTrigger) gsap.to(st, { yaw: "+=0.5", ease: "none", scrollTrigger: { trigger: host, start: "top 70%", end: "bottom top", scrub: 0.8 } });

  // pointer: drag to spin, release eases back; hover tilts
  var down = false, lastX = 0;
  host.style.touchAction = "pan-y"; host.style.cursor = "grab";
  host.addEventListener("pointerdown", function (e) { down = true; lastX = e.clientX; host.style.cursor = "grabbing"; gsap.killTweensOf(st, "drag"); });
  window.addEventListener("pointerup", function () { if (!down) return; down = false; host.style.cursor = "grab"; gsap.to(st, { drag: 0, duration: 1.4, ease: "elastic.out(1,.6)" }); });
  window.addEventListener("pointermove", function (e) { if (!down) return; st.drag += (e.clientX - lastX) * 0.006; lastX = e.clientX; });
  var qy = gsap.quickTo(st, "ty", { duration: 0.8, ease: "power3.out" });
  host.addEventListener("pointermove", function (e) { var r = host.getBoundingClientRect(); qy(((e.clientY - r.top) / r.height - 0.5) * -0.12); });
  host.addEventListener("pointerleave", function () { qy(0); });
})();
