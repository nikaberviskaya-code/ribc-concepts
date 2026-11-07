/* RIBC concept E — motion.
   Motion design (LottieFiles motion-design skill): archetype = PREMIUM (elegant, no overshoot, decelerating entrances).
   Signature easing  "emph" (.05,.7,.1,1) for entrances, "std" (.4,0,.2,1) for on-screen moves, "exit" (.3,0,1,1) for exits.
   Duration palette  quick .24 / standard .5 / slow 1.0 (hero reveal .9).   Entrance pattern: rise 16-28px + fade.
   Layers: primary (headline, route, rows) · secondary (cards, labels, counters) · ambient (glow, arcade parallax, globe sway, flow dot).
   Rules kept: stagger spread <= .4s, <= 1/3 of the screen travelled, transform+opacity only, reduced motion = final state. */
(function () {
  var nav = document.getElementById("nav");
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };

  // nav goes light once the dark hero has passed (colour only, not motion)
  function navState() {
    if (!window.ScrollTrigger) return;
    ScrollTrigger.create({ trigger: ".hero", start: "bottom top+=64", onEnter: function () { nav.classList.add("solid"); }, onLeaveBack: function () { nav.classList.remove("solid"); } });
  }


  // ---- form: validation, error shake, success draw (works with or without motion)
  function initForm(motion) {
    var form = q(".form"); if (!form) return;
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = [];
      qa(".f", form).forEach(function (f) {
        var inp = q("input", f), ok = inp.value.trim() && (inp.type !== "email" || /^\S+@\S+\.\S+$/.test(inp.value));
        f.classList.toggle("bad", !ok); inp.setAttribute("aria-invalid", ok ? "false" : "true"); if (!ok) bad.push(f);
      });
      if (bad.length) {
        q("input", bad[0]).focus({ preventScroll: false });
        if (motion) gsap.fromTo(bad, { x: 0 }, { keyframes: [{ x: -12 }, { x: 12 }, { x: -8 }, { x: 8 }, { x: 0 }], duration: 0.36, ease: "power2.inOut", clearProps: "transform" });
        return;
      }
      if (/[?&]submit=error/.test(location.search)) {  // demo of the failure state: open index.html?submit=error
        var fail = q(".fail", form); fail.classList.add("on");
        if (motion) gsap.timeline({ defaults: { ease: "emph" } })
          .fromTo(fail, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.4 })
          .fromTo(".f-ring", { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5 }, 0.1)
          .fromTo(".f-x", { opacity: 0, scale: 0.8, transformOrigin: "50% 50%" }, { opacity: 1, scale: 1, duration: 0.3 }, 0.4)
          .from(".fail h3, .fail p, .fail .btn", { y: 12, opacity: 0, duration: 0.4, stagger: 0.06 }, 0.5);
        return;
      }
      var done = q(".done", form); done.classList.add("on");
      if (!motion) return;
      gsap.timeline({ defaults: { ease: "emph" } })
        .fromTo(done, { opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1, duration: 0.4 })
        .fromTo(".d-ring", { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.5 }, 0.1)
        .fromTo(".d-tick", { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.35 }, 0.45)
        .from(".done h3", { y: 12, opacity: 0, duration: 0.4 }, 0.55);
    });
    var retry = q(".fail .btn", form); if (retry) retry.addEventListener("click", function () { q(".fail", form).classList.remove("on"); var f = q("input", form); if (f) f.focus(); });
    qa(".f input", form).forEach(function (i) { i.addEventListener("input", function () { i.parentNode.classList.remove("bad"); i.setAttribute("aria-invalid", "false"); }); });
  }

  if (!window.gsap || !window.ScrollTrigger) { navState(); initForm(false); return; }
  gsap.registerPlugin(ScrollTrigger, CustomEase);
  CustomEase.create("emph", ".05,.7,.1,1"); CustomEase.create("std", ".4,0,.2,1"); CustomEase.create("exit", ".3,0,1,1");
  navState();

  function splitWords(el, mode) {
    var orig = el.innerHTML, out = [];
    el.setAttribute("aria-label", el.textContent.trim());
    (function walk(node) {
      [].slice.call(node.childNodes).forEach(function (c) {
        if (c.nodeType === 3) {
          var frag = document.createDocumentFragment();
          c.textContent.split(/(\s+)/).forEach(function (tok) {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(" ")); return; }
            var w = document.createElement("span"); w.setAttribute("aria-hidden", "true");
            if (mode === "mask") { w.className = "w"; var wi = document.createElement("span"); wi.className = "wi"; wi.textContent = tok; w.appendChild(wi); out.push(wi); }
            else { w.className = "qw"; w.textContent = tok; out.push(w); }
            frag.appendChild(w);
          });
          node.replaceChild(frag, c);
        } else if (c.nodeType === 1) walk(c);
      });
    })(el);
    return { words: out, revert: function () { el.innerHTML = orig; el.removeAttribute("aria-label"); } };
  }

  var mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: reduce)", function () { initForm(false); });
  mm.add("(prefers-reduced-motion: no-preference)", function () {
    initForm(true);
    var undo = [], ambient = [];

    // ---------- HERO: setup (ambient) -> action (headline, route) -> resolution (cards)
    var h1 = splitWords(q(".hero h1"), "mask"); undo.push(h1.revert);
    var tl = gsap.timeline({ defaults: { ease: "emph" } });
    tl.from(".glow", { opacity: 0, duration: 1.4, ease: "std" }, 0)
      .from(".ar-back", { yPercent: 8, opacity: 0, duration: 1.2 }, 0.05)
      .from(".ar-front", { yPercent: 12, opacity: 0, duration: 1.2 }, 0.15)
      .from(".nav-pill, .nav > .btn", { y: -14, opacity: 0, duration: 0.5, stagger: 0.08 }, 0.2)
      .from(h1.words, { yPercent: 108, duration: 0.9, stagger: { amount: 0.3 } }, 0.25)
      .add(function () { if (window.RIBCGlobe && RIBCGlobe.intro) RIBCGlobe.intro.play(0); }, 0.4)
      .from(".hero .lead", { y: 16, opacity: 0, duration: 0.5 }, 0.95)
      .from(".hero-copy .btn", { y: 14, opacity: 0, duration: 0.5 }, 1.05)
      .from(".cards3 .card", { y: 28, opacity: 0, duration: 0.6, stagger: { amount: 0.3 } }, 1.35);
    // secondary: mini visuals inside the cards finish what the cards start
    var tick = q(".m-tick"); if (tick) { var L = tick.getTotalLength(); gsap.set(tick, { strokeDasharray: L, strokeDashoffset: L }); }
    tl.from(".m-chk", { scale: 0, transformOrigin: "50% 50%", duration: 0.4 }, 1.8)
      .to(tick, { strokeDashoffset: 0, duration: 0.35, ease: "std" }, 1.95)
      .fromTo(".m-prog", { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.9, ease: "std" }, 1.9)
      .to(".m-dot", { fill: "#F4A15D", stroke: "#F4A15D", duration: 0.3, stagger: { amount: 0.6 } }, 1.95)
      .from(".m-col", { scaleY: 0, transformOrigin: "50% 100%", duration: 0.6, stagger: { amount: 0.35 } }, 1.9);
    // ambient layer
    ambient.push(gsap.to(".glow", { opacity: 0.8, duration: 5, ease: "sine.inOut", yoyo: true, repeat: -1, delay: 2 }));
    ambient.push(gsap.to(".m-line", { strokeDashoffset: -20, duration: 1.4, ease: "none", repeat: -1 }));
    gsap.to(".arcade", { yPercent: 12, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 } });
    gsap.to(".hero-copy", { y: -40, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.6 } });
    if (window.RIBCGlobe && RIBCGlobe.scroll) RIBCGlobe.scroll(".hero");
    ScrollTrigger.create({ trigger: ".hero", start: "top bottom", end: "bottom top", onToggle: function (s) {
      ambient.forEach(function (t) { s.isActive ? t.resume() : t.pause(); }); if (window.RIBCGlobe) RIBCGlobe.setActive(s.isActive); } });

    // ---------- SECTIONS: one entrance pattern everywhere (rise + fade, decelerate)
    ScrollTrigger.batch(".s h2, .s .kicker, .leader .sub, .s .btn:not(.rupee-panel .btn), .join-text p, .foot-name", {
      start: "top 90%", once: true,
      onEnter: function (el) { gsap.from(el, { y: 20, opacity: 0, duration: 0.5, ease: "emph", stagger: 0.08, clearProps: "transform,opacity" }); }
    });
    [".rows", ".chips", ".news ul"].forEach(function (sel) {
      var list = q(sel); if (!list) return;
      gsap.from(list.children, { y: 20, opacity: 0, duration: 0.5, ease: "emph", stagger: { amount: 0.4 }, clearProps: "transform,opacity", scrollTrigger: { trigger: list, start: "top 88%", once: true } });
    });
    // quote: words light up as you read (scrub, linear on purpose: it is progress)
    var qs = splitWords(q("blockquote"), "words"); undo.push(qs.revert);
    gsap.from(".portrait", { opacity: 0, y: 28, clipPath: "inset(0 0 100% 0 round 28px)", duration: 1.0, ease: "emph", scrollTrigger: { trigger: ".portrait", start: "top 85%", once: true } });
    gsap.fromTo(qs.words, { opacity: 0.16 }, { opacity: 1, ease: "none", stagger: 0.12, scrollTrigger: { trigger: "blockquote", start: "top 80%", end: "bottom 55%", scrub: 0.6 } });
    gsap.from(".lead-body figcaption", { y: 16, opacity: 0, duration: 0.5, ease: "emph", clearProps: "transform,opacity", scrollTrigger: { trigger: ".lead-body figcaption", start: "top 94%", once: true } });
    // events
    gsap.from(".ev, .counter", { y: 28, opacity: 0, duration: 0.6, ease: "emph", stagger: { amount: 0.3 }, clearProps: "transform,opacity", scrollTrigger: { trigger: ".ev-grid", start: "top 88%", once: true } });
    var b = q(".counter b"), o = { v: 0 }; b.textContent = "0"; undo.push(function () { b.textContent = "20"; });
    gsap.to(o, { v: 20, duration: 1.2, ease: "emph", snap: { v: 1 }, onUpdate: function () { b.textContent = o.v; }, scrollTrigger: { trigger: b, start: "top 90%", once: true } });
    // rupee: panel lands, then the transfer line shows the idea (no conversion in between)
    gsap.from(".rupee-panel", { y: 40, opacity: 0, duration: 0.8, ease: "emph", clearProps: "transform,opacity", scrollTrigger: { trigger: ".rupee-panel", start: "top 88%", once: true } });
    gsap.from(".xfer .cur, .xfer .tags span", { y: 14, opacity: 0, duration: 0.5, ease: "emph", stagger: { amount: 0.3 }, delay: 0.3, clearProps: "transform,opacity", scrollTrigger: { trigger: ".xfer", start: "top 88%", once: true } });
    var flow = [
      gsap.fromTo(".flow-dot", { attr: { cx: 0 } }, { attr: { cx: 200 }, duration: 1.6, ease: "std", repeat: -1, repeatDelay: 0.6, paused: true }),
      gsap.to(".flow-line", { strokeDashoffset: -24, duration: 1.6, ease: "none", repeat: -1, paused: true })];
    ScrollTrigger.create({ trigger: ".xfer", start: "top bottom", end: "bottom top", onToggle: function (s) { flow.forEach(function (t) { s.isActive ? t.resume() : t.pause(); }); } });
    // form card
    gsap.from(".form > h3, .form label, .form .consent, .form .btn", { y: 16, opacity: 0, duration: 0.5, ease: "emph", stagger: { amount: 0.4 }, clearProps: "transform,opacity", scrollTrigger: { trigger: ".form", start: "top 88%", once: true } });

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
    return function () { undo.forEach(function (f) { f(); }); };
  });
})();
