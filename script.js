/* ==========================================================================
   Jeferson Fianitog — motion layer
   Lenis smooth scroll + GSAP ScrollTrigger · see BUILD-PLAN.md §22–25
   ========================================================================== */
(function () {
  "use strict";

  var doc = document.documentElement;
  doc.classList.remove("no-js");
  doc.classList.add("js");

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var small = window.matchMedia("(max-width: 860px)").matches;
  var hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";

  if (reduced || !hasGsap) doc.classList.add("reduced");

  /* ---------- Year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector(".nav__toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = doc.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.querySelectorAll(".nav__links a").forEach(function (a) {
      a.addEventListener("click", function () {
        doc.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ---------- Lightbox (case studies) ---------- */
  initLightbox();

  if (reduced || !hasGsap) {
    hidePreloader();
    // Still show the counters' final values and keep videos as posters.
    return;
  }

  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  gsap.registerPlugin(ST);

  /* ---------- Lenis smooth scroll ---------- */
  var lenis = null;
  if (typeof window.Lenis !== "undefined") {
    lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
    lenis.on("scroll", ST.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;

    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener("click", function (e) {
        var id = a.getAttribute("href");
        if (id.length < 2) return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -20, duration: 1.4 });
      });
    });
  }

  document.querySelectorAll("[data-to-top]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (lenis) lenis.scrollTo(0, { duration: 1.6 }); else window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  /* ---------- Nav hide/show ---------- */
  var nav = document.querySelector(".nav");
  if (nav) {
    var last = 0;
    ST.create({
      start: 0, end: "max",
      onUpdate: function (self) {
        var y = self.scroll();
        nav.classList.toggle("is-solid", y > 40);
        if (!doc.classList.contains("nav-open")) nav.classList.toggle("is-hidden", y > last && y > 300);
        last = y;
      }
    });
  }

  /* ---------- Text splitting ---------- */
  function splitWords(el) {
    if (el.dataset.splitDone) return el.querySelectorAll(".word");
    var lines = el.innerHTML.split(/<br\s*\/?>/i);
    el.innerHTML = lines.map(function (line) {
      var tmp = document.createElement("div");
      tmp.innerHTML = line;
      var out = "";
      tmp.childNodes.forEach(function (node) {
        if (node.nodeType === 3) {
          out += node.textContent.split(/(\s+)/).map(function (w) {
            return /^\s+$/.test(w) || !w ? w : '<span class="word">' + w + "</span>";
          }).join("");
        } else {
          var tag = node.nodeName.toLowerCase();
          var inner = node.textContent.split(/(\s+)/).map(function (w) {
            return /^\s+$/.test(w) || !w ? w : '<span class="word">' + w + "</span>";
          }).join("");
          out += "<" + tag + ">" + inner + "</" + tag + ">";
        }
      });
      return '<span class="line">' + out + "</span>";
    }).join("");
    el.classList.add("split");
    el.dataset.splitDone = "1";
    return el.querySelectorAll(".word");
  }

  /* ---------- Preloader → hero intro ---------- */
  var heroTitle = document.querySelector(".hero__title");
  var heroWords = heroTitle ? splitWords(heroTitle) : [];
  if (heroWords.length) gsap.set(heroWords, { yPercent: 115 });
  gsap.set(".hero__eyebrow, .hero__sub, .hero .btn-row, .hero__scroll, .hero__badge", { autoAlpha: 0, y: 20 });

  var intro = gsap.timeline({ paused: true });
  intro
    .to(heroWords, { yPercent: 0, duration: 1.1, ease: "power4.out", stagger: 0.07 })
    .to(".hero__eyebrow, .hero__sub, .hero .btn-row", { autoAlpha: 1, y: 0, duration: 0.9, ease: "power3.out", stagger: 0.1 }, "-=0.7")
    .to(".hero__scroll, .hero__badge", { autoAlpha: 1, y: 0, duration: 0.8, ease: "power3.out" }, "-=0.5");

  var pre = document.querySelector(".preloader");
  if (pre) {
    var bar = pre.querySelector(".preloader__bar");
    var mark = pre.querySelectorAll(".preloader__mark span");
    var pl = gsap.timeline({ onComplete: function () { pre.remove(); intro.play(); } });
    pl.from(mark, { yPercent: 110, duration: 0.8, ease: "power4.out", stagger: 0.08 })
      .to(bar, { width: "100%", duration: 0.9, ease: "power2.inOut" }, 0.1)
      .to(mark, { yPercent: -110, duration: 0.6, ease: "power3.in", stagger: 0.05 }, "+=0.15")
      .to(pre, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "-=0.25");
  } else {
    intro.play();
  }

  /* ---------- Scroll-scrubbed video (with poster fallback) ---------- */
  function scrubVideo(video, trigger, start, end) {
    if (!video) return;
    var ready = false;
    var target = 0;
    var raf = null;
    function apply() {
      raf = null;
      if (!ready || !video.duration) return;
      var t = target * (video.duration - 0.05);
      if (Math.abs(video.currentTime - t) > 0.01) video.currentTime = t;
    }
    video.addEventListener("loadedmetadata", function () { ready = true; video.pause(); apply(); });
    video.addEventListener("error", function () { video.remove(); }, true);
    video.load();
    ST.create({
      trigger: trigger, start: start, end: end, scrub: true,
      onUpdate: function (self) {
        target = self.progress;
        if (!raf) raf = requestAnimationFrame(apply);
      }
    });
  }

  // Remove <video> elements whose sources are not generated yet → posters/images show instead.
  document.querySelectorAll("video[data-scene]").forEach(function (v) {
    var src = v.querySelector("source");
    if (!src) return;
    fetch(src.getAttribute("src"), { method: "HEAD" }).then(function (r) {
      if (!r.ok) v.remove();
    }).catch(function () { v.remove(); });
  });

  var heroVideo = document.querySelector(".hero video");
  var pillarsVideo = document.querySelector(".pillars video");
  var ctaVideo = document.querySelector(".cta video");

  if (!small) {
    scrubVideo(heroVideo, ".hero", "top top", "bottom bottom");
    scrubVideo(pillarsVideo, ".pillars", "top bottom", "bottom top");
  } else {
    // Phones: the hero orbit loops in its framed panel; the pillars clip loops behind the services
    [heroVideo, pillarsVideo].forEach(function (v) {
      if (!v) return;
      v.setAttribute("autoplay", ""); v.setAttribute("loop", "");
      v.play && v.play().catch(function () {});
    });
  }
  if (ctaVideo) {
    // Loop the System clip while the section is on screen; pause it when scrolled away
    var playCta = function () { ctaVideo.play && ctaVideo.play().catch(function () {}); };
    var pauseCta = function () { ctaVideo.pause && ctaVideo.pause(); };
    ST.create({
      trigger: ".cta", start: "top 75%", end: "bottom 25%",
      onEnter: playCta, onEnterBack: playCta, onLeave: pauseCta, onLeaveBack: pauseCta
    });
  }

  /* ---------- Hero scroll-out ---------- */
  if (document.querySelector(".hero") && !small) {
    gsap.to(".hero__content", {
      scale: 0.92, autoAlpha: 0, yPercent: -8, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "55% top", scrub: true }
    });
    gsap.to(".hero__media img", {
      scale: 1.12, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom bottom", scrub: true }
    });
  }

  /* ---------- Section headlines (kinetic) ---------- */
  document.querySelectorAll("[data-split]").forEach(function (el) {
    var words = splitWords(el);
    gsap.from(words, {
      yPercent: 115, duration: 1, ease: "power4.out", stagger: 0.05,
      scrollTrigger: { trigger: el, start: "top 85%" }
    });
  });

  /* ---------- Generic reveals ---------- */
  gsap.utils.toArray(".reveal").forEach(function (el) {
    gsap.to(el, {
      autoAlpha: 1, y: 0, duration: 1, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%" }
    });
  });

  /* ---------- Counters ---------- */
  document.querySelectorAll("[data-count]").forEach(function (el) {
    var end = parseFloat(el.dataset.count);
    var prefix = el.dataset.prefix || "";
    var suffix = el.dataset.suffix || "";
    var obj = { v: 0 };
    el.innerHTML = prefix + "0" + suffix;
    ST.create({
      trigger: el, start: "top 90%", once: true,
      onEnter: function () {
        gsap.to(obj, {
          v: end, duration: 1.6, ease: "power3.out",
          onUpdate: function () {
            el.innerHTML = prefix + Math.round(obj.v).toLocaleString("en-US") + suffix;
          }
        });
      }
    });
  });

  /* ---------- Marquee (velocity-reactive) ---------- */
  var track = document.querySelector(".marquee__track");
  if (track) {
    var loop = gsap.to(track, { xPercent: -50, ease: "none", duration: 40, repeat: -1 });
    if (lenis) {
      lenis.on("scroll", function (e) {
        var v = Math.min(Math.abs(e.velocity || 0) / 8, 3);
        gsap.to(loop, { timeScale: 1 + v, duration: 0.3, overwrite: true });
      });
    }
  }

  /* ---------- Mission: word-by-word fill ---------- */
  var mission = document.querySelector(".mission__text");
  if (mission) {
    var mw = splitWords(mission);
    gsap.to(mw, {
      opacity: 1, ease: "none", stagger: 0.05,
      scrollTrigger: { trigger: mission, start: "top 75%", end: "bottom 45%", scrub: true }
    });
  }

  /* ---------- Featured work: stacked cards scale back ---------- */
  var cards = gsap.utils.toArray(".stack .card");
  if (cards.length && !small) {
    cards.forEach(function (card, i) {
      if (i === cards.length - 1) return;
      gsap.to(card, {
        scale: 0.92, filter: "brightness(0.72)", ease: "none",
        scrollTrigger: { trigger: cards[i + 1], start: "top bottom", end: "top 92px", scrub: true }
      });
    });
  }

  /* ---------- Parallax images ---------- */
  gsap.utils.toArray("[data-parallax]").forEach(function (el) {
    var amt = parseFloat(el.dataset.parallax) || 12;
    gsap.fromTo(el, { yPercent: -amt / 2 }, {
      yPercent: amt / 2, ease: "none",
      scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true }
    });
  });

  /* ---------- Timeline line draw ---------- */
  var tl = document.querySelector(".timeline__line i");
  if (tl) {
    gsap.to(tl, {
      scaleX: 1, scaleY: 1, ease: "none",
      scrollTrigger: { trigger: ".timeline", start: "top 80%", end: "bottom 60%", scrub: true }
    });
  }

  /* ---------- Footer wordmark slide ---------- */
  var wm = document.querySelector(".wordmark");
  if (wm) {
    gsap.fromTo(wm, { xPercent: 12 }, {
      xPercent: -4, ease: "none",
      scrollTrigger: { trigger: ".footer", start: "top bottom", end: "bottom bottom", scrub: true }
    });
  }

  /* ---------- Desktop-only interactions ---------- */
  if (fine) {
    // Cursor
    var dot = document.createElement("div"); dot.className = "cursor";
    var ring = document.createElement("div"); ring.className = "cursor-ring"; ring.innerHTML = "<span>View</span>";
    document.body.appendChild(dot); document.body.appendChild(ring);
    var dx = gsap.quickTo(dot, "x", { duration: 0.08 }), dy = gsap.quickTo(dot, "y", { duration: 0.08 });
    var rx = gsap.quickTo(ring, "x", { duration: 0.35, ease: "power3" }), ry = gsap.quickTo(ring, "y", { duration: 0.35, ease: "power3" });
    window.addEventListener("pointermove", function (e) { doc.classList.add("has-cursor"); dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); });
    document.addEventListener("pointerleave", function () { doc.classList.remove("has-cursor"); });
    document.querySelectorAll("a, button").forEach(function (el) {
      el.addEventListener("pointerenter", function () { ring.classList.add(el.closest("[data-cursor='view']") ? "is-view" : "is-link"); });
      el.addEventListener("pointerleave", function () { ring.classList.remove("is-link", "is-view"); });
    });

    // Magnetic buttons
    document.querySelectorAll("[data-magnetic]").forEach(function (btn) {
      var mx = gsap.quickTo(btn, "x", { duration: 0.4, ease: "power3" });
      var my = gsap.quickTo(btn, "y", { duration: 0.4, ease: "power3" });
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        mx((e.clientX - r.left - r.width / 2) * 0.22);
        my((e.clientY - r.top - r.height / 2) * 0.32);
      });
      btn.addEventListener("pointerleave", function () { mx(0); my(0); });
    });

    // Project index hover image
    var hover = document.querySelector(".hover-img");
    if (hover) {
      var himg = hover.querySelector("img");
      var hx = gsap.quickTo(hover, "x", { duration: 0.5, ease: "power3" });
      var hy = gsap.quickTo(hover, "y", { duration: 0.5, ease: "power3" });
      window.addEventListener("pointermove", function (e) { hx(e.clientX); hy(e.clientY); });
      document.querySelectorAll(".index__row a[data-img]").forEach(function (a) {
        a.addEventListener("pointerenter", function () {
          himg.src = a.dataset.img;
          gsap.to(hover, { opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" });
        });
        a.addEventListener("pointerleave", function () {
          gsap.to(hover, { opacity: 0, scale: 0.85, duration: 0.3, ease: "power3.in" });
        });
      });
    }
  }

  window.addEventListener("load", function () { ST.refresh(); });

  function hidePreloader() {
    var p = document.querySelector(".preloader");
    if (p) p.remove();
  }

  /* ---------- Lightbox ---------- */
  function initLightbox() {
    var items = Array.prototype.slice.call(document.querySelectorAll("[data-lightbox]"));
    if (!items.length) return;
    var box = document.createElement("div");
    box.className = "lightbox";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = '<button class="lightbox__close" aria-label="Close">✕</button>' +
      '<button class="lightbox__nav lightbox__nav--prev" aria-label="Previous">←</button>' +
      '<figure><img alt=""><p></p></figure>' +
      '<button class="lightbox__nav lightbox__nav--next" aria-label="Next">→</button>';
    document.body.appendChild(box);
    var img = box.querySelector("img"), cap = box.querySelector("p"), idx = 0, opener = null;
    function show(i) {
      idx = (i + items.length) % items.length;
      var it = items[idx];
      img.src = it.dataset.lightbox;
      img.alt = it.dataset.caption || "";
      cap.textContent = it.dataset.caption || "";
    }
    function open(i) { opener = items[i]; show(i); box.classList.add("is-open"); if (window.__lenis) window.__lenis.stop(); box.querySelector(".lightbox__close").focus(); }
    function close() { box.classList.remove("is-open"); if (window.__lenis) window.__lenis.start(); if (opener) opener.focus(); }
    items.forEach(function (it, i) { it.addEventListener("click", function () { open(i); }); });
    box.querySelector(".lightbox__close").addEventListener("click", close);
    box.querySelector(".lightbox__nav--prev").addEventListener("click", function () { show(idx - 1); });
    box.querySelector(".lightbox__nav--next").addEventListener("click", function () { show(idx + 1); });
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    document.addEventListener("keydown", function (e) {
      if (!box.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(idx - 1);
      if (e.key === "ArrowRight") show(idx + 1);
    });
  }
})();
