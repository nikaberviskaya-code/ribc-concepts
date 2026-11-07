/* RIBC globe (dark): dotted Earth + Moscow -> Delhi route. Three.js r187 classic build; timeline is exposed for app.js to place in the hero sequence. */
(function () {
  var host = document.getElementById("globe");
  window.RIBCGlobe = { intro: null, setActive: function () {} };
  if (!host || !window.THREE || !window.GLOBE_LAND) return;
  var T = THREE, R = 1.2;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var renderer;
  try { renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); } catch (e) { return; }
  var canvas = renderer.domElement; host.appendChild(canvas);
  var scene = new T.Scene(), camera = new T.PerspectiveCamera(30, 1, 0.1, 50); camera.position.set(0, 0, 5);
  function ll(lat, lon, r) { var a = lat * Math.PI / 180, o = lon * Math.PI / 180; return new T.Vector3(r * Math.cos(a) * Math.sin(o), r * Math.sin(a), r * Math.cos(a) * Math.cos(o)); }
  var globe = new T.Group(); scene.add(globe);
  globe.add(new T.Mesh(new T.SphereGeometry(R * 0.995, 64, 48), new T.MeshBasicMaterial({ color: 0x1F150D })));
  var bin = atob(window.GLOBE_LAND), n = bin.length / 4, pos = new Float32Array(n * 3), dv = new DataView(new ArrayBuffer(bin.length));
  for (var i = 0; i < bin.length; i++) dv.setUint8(i, bin.charCodeAt(i));
  for (var k = 0; k < n; k++) { var p = ll(dv.getInt16(k * 4, true) / 100, dv.getInt16(k * 4 + 2, true) / 100, R); pos[k * 3] = p.x; pos[k * 3 + 1] = p.y; pos[k * 3 + 2] = p.z; }
  var geo = new T.BufferGeometry(); geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  var dots = new T.Points(geo, new T.PointsMaterial({ color: 0xF2D9BC, size: 0.02, sizeAttenuation: true, transparent: true, opacity: 0 })); globe.add(dots);
  var rim = new T.Mesh(new T.RingGeometry(R * 0.995, R * 1.01, 128), new T.MeshBasicMaterial({ color: 0xF07A2B, transparent: true, opacity: 0.4 })); rim.position.z = -0.01; scene.add(rim);
  var MSK = { lat: 55.75, lon: 37.62 }, DEL = { lat: 28.61, lon: 77.21 };
  var a = ll(MSK.lat, MSK.lon, 1), b = ll(DEL.lat, DEL.lon, 1), ang = a.angleTo(b), pts = [];
  for (var s = 0; s <= 96; s++) { var t = s / 96, sa = Math.sin((1 - t) * ang) / Math.sin(ang), sb = Math.sin(t * ang) / Math.sin(ang);
    pts.push(a.clone().multiplyScalar(sa).add(b.clone().multiplyScalar(sb)).normalize().multiplyScalar(R * (1.003 + 0.2 * Math.sin(Math.PI * t)))); }
  var curve = new T.CatmullRomCurve3(pts), tube = new T.TubeGeometry(curve, 160, 0.008, 6, false);
  globe.add(new T.Mesh(tube, new T.MeshBasicMaterial({ color: 0xF07A2B }))); var total = tube.index.count; tube.setDrawRange(0, 0);
  function marker(c, col) { var g = new T.Group(); g.position.copy(ll(c.lat, c.lon, R * 1.004));
    g.add(new T.Mesh(new T.SphereGeometry(0.028, 16, 12), new T.MeshBasicMaterial({ color: col })));
    var ring = new T.Mesh(new T.RingGeometry(0.042, 0.049, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, side: T.DoubleSide }));
    ring.lookAt(g.position.clone().multiplyScalar(2)); g.add(ring); g.userData.ring = ring; globe.add(g); return g; }
  var mMsk = marker(MSK, 0xF6EFE6), mDel = marker(DEL, 0xF07A2B); mMsk.scale.setScalar(0); mDel.scale.setScalar(0);
  var pulse = new T.Mesh(new T.SphereGeometry(0.022, 12, 10), new T.MeshBasicMaterial({ color: 0xFFFFFF })); pulse.visible = false; globe.add(pulse);
  function label(text, cls) { var el = document.createElement("span"); el.className = "glabel" + (cls ? " " + cls : ""); el.textContent = text; host.appendChild(el); return el; }
  var lMsk = label("МОСКВА", "l"), lDel = label("ДЕЛИ");
  var st = { yaw: 0, tilt: 0.36, drag: 0, ty: 0, sway: 0, scroll: 0, draw: 0, pulseT: 0 };
  var baseYaw = -(MSK.lon + DEL.lon) / 2 * Math.PI / 180;
  function resize() { var w = host.clientWidth, h = host.clientHeight || w; renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(host); resize();
  var tmp = new T.Vector3();
  function place(el, obj) { obj.getWorldPosition(tmp); var front = tmp.clone().normalize().dot(camera.position.clone().sub(tmp).normalize()) > 0.02; tmp.project(camera);
    el.style.transform = "translate(" + ((tmp.x * 0.5 + 0.5) * host.clientWidth).toFixed(1) + "px," + ((-tmp.y * 0.5 + 0.5) * host.clientHeight).toFixed(1) + "px)"; el.dataset.vis = front ? "1" : "0"; }
  function render() {
    globe.rotation.y = baseYaw + st.yaw + st.sway + st.drag + st.scroll; globe.rotation.x = st.tilt + st.ty;
    tube.setDrawRange(0, Math.floor(st.draw * total / 3) * 3);
    if (st.pulseT > 0) { pulse.visible = true; pulse.position.copy(curve.getPointAt(Math.min(st.pulseT, 1))); } else pulse.visible = false;
    var ph = (performance.now() / 1600) % 1, ph2 = ((performance.now() + 800) / 1600) % 1;
    mMsk.userData.ring.scale.setScalar(1 + 0.5 * ph); mMsk.userData.ring.material.opacity = 0.6 * (1 - ph);
    mDel.userData.ring.scale.setScalar(1 + 0.5 * ph2); mDel.userData.ring.material.opacity = 0.6 * (1 - ph2);
    globe.updateMatrixWorld(true); place(lMsk, mMsk); place(lDel, mDel); renderer.render(scene, camera);
  }
  if (reduce || !window.gsap) { // still frame in the final state
    dots.material.opacity = 0.72; st.draw = 1; mMsk.scale.setScalar(1); mDel.scale.setScalar(1); lMsk.dataset.on = lDel.dataset.on = "1"; render(); new ResizeObserver(render).observe(host); return; }
  var running = false, tick = function () { render(); };
  function run(on) { if (on && !running) { gsap.ticker.add(tick); running = true; } else if (!on && running) { gsap.ticker.remove(tick); running = false; } }
  window.RIBCGlobe.setActive = run; run(true);
  // intro (paused): setup -> action -> resolution. Premium archetype: no overshoot, decelerating entrances.
  gsap.registerPlugin(CustomEase); CustomEase.create("emph", ".05,.7,.1,1"); CustomEase.create("std", ".4,0,.2,1");
  var tl = gsap.timeline({ paused: true });
  tl.fromTo(st, { yaw: 2.2 }, { yaw: 0, duration: 1.6, ease: "emph" }, 0)
    .to(dots.material, { opacity: 0.72, duration: 0.8, ease: "std" }, 0)
    .to(mMsk.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: "emph" }, 0.9)
    .set(lMsk.dataset, { on: "1" }, 1.0)
    .to(st, { draw: 1, duration: 1.2, ease: "std" }, 1.1)
    .to(mDel.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: "emph" }, 2.1)
    .set(lDel.dataset, { on: "1" }, 2.2)
    .add(function () { // ambient layer: sway and a travelling pulse
      gsap.to(st, { sway: 0.1, duration: 7, ease: "sine.inOut", yoyo: true, repeat: -1 });
      gsap.to(st, { pulseT: 1, duration: 2.6, ease: "sine.inOut", repeat: -1, repeatDelay: 1.4, onRepeat: function () { st.pulseT = 0.001; } }); st.pulseT = 0.001; }, 2.3);
  window.RIBCGlobe.intro = tl;
  window.RIBCGlobe.scroll = function (trigger) { gsap.to(st, { scroll: 0.5, ease: "none", scrollTrigger: { trigger: trigger, start: "top top", end: "bottom top", scrub: 0.8 } }); };
  // pointer: drag to spin (releases with a damped return), vertical hover tilts
  var down = false, lastX = 0; host.parentElement.addEventListener("pointerdown", function (e) { if (e.target.closest("a,button")) return; down = true; lastX = e.clientX; gsap.killTweensOf(st, "drag"); });
  window.addEventListener("pointerup", function () { if (!down) return; down = false; gsap.to(st, { drag: 0, duration: 1.2, ease: "std" }); });
  window.addEventListener("pointermove", function (e) { if (down) { st.drag += (e.clientX - lastX) * 0.005; lastX = e.clientX; } });
})();
