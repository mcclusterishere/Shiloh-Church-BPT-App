/* Shiloh — the ambient light field.
 *
 * Draws slowly drifting pools of jewel-toned light behind the whole app, the
 * way afternoon light moves through a stained-glass window over the course of
 * a service.
 *
 * The trick that makes this essentially free: it renders to a TINY canvas
 * (about 90px wide) and lets the browser's own bilinear upscaling do the
 * diffusion. There is no blur shader, no per-pixel work, no layout thrash —
 * just a handful of radial gradients on a postage stamp, stretched to fill the
 * screen. It runs at 20fps because the motion is slow enough that nobody can
 * tell, and it stops completely when it isn't wanted.
 *
 * It yields immediately and permanently to:
 *   - prefers-reduced-motion  (renders one static frame, never animates)
 *   - comfort mode            (removes itself entirely)
 *   - a hidden tab            (stops the loop, resumes on return)
 */
"use strict";

window.ShilohAmbient = (function () {
  var canvas, ctx, raf = null, running = false;
  var W = 90, H = 160;            /* render resolution — deliberately tiny */
  var FPS = 20, lastDraw = 0;
  var start = null;

  /* Light through a real window has a DIRECTION — it is not a ring of coloured
     lamps. One dominant warm source high on the left (the sun through the
     window), a deep ruby fall from the same side, and one cool counterpoint low
     and opposite to keep it from going monochrome. Restraint is the whole
     point: this should read as light in a room, and most people should never
     consciously notice it at all.
     `w` is each pool's weight — its share of the total light. */
  var LIGHTS = [
    { hue: 34,  sat: 70, x: 0.26, y: 0.06, r: 1.05, drift: 0.10, period: 79,  phase: 0.0, w: 1.00 },
    { hue: 352, sat: 62, x: 0.10, y: 0.34, r: 0.80, drift: 0.09, period: 103, phase: 2.1, w: 0.62 },
    { hue: 196, sat: 45, x: 0.86, y: 0.82, r: 0.90, drift: 0.11, period: 127, phase: 3.9, w: 0.44 }
  ];

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function isDark() {
    var attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark") return true;
    if (attr === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function comfortOn() {
    return document.documentElement.getAttribute("data-comfort") === "on";
  }

  function draw(tMs) {
    var dark = isDark();
    var t = tMs / 1000;

    ctx.clearRect(0, 0, W, H);

    /* Base wash. In dark mode the pools glow additively out of the ink; in
       light mode they tint warm paper, so they read as light *through*
       something rather than lamps sitting on top of it. */
    ctx.globalCompositeOperation = dark ? "lighter" : "multiply";
    if (!dark) { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H); }

    for (var i = 0; i < LIGHTS.length; i++) {
      var L = LIGHTS[i];
      var a = (t / L.period) * Math.PI * 2 + L.phase;
      var cx = (L.x + Math.cos(a) * L.drift) * W;
      var cy = (L.y + Math.sin(a * 0.8) * L.drift * 0.8) * H;
      var rad = L.r * W;

      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      if (dark) {
        g.addColorStop(0, "hsla(" + L.hue + "," + L.sat + "%,50%," + (0.30 * L.w) + ")");
        g.addColorStop(0.5, "hsla(" + L.hue + "," + L.sat + "%,38%," + (0.11 * L.w) + ")");
        g.addColorStop(1, "hsla(" + L.hue + "," + L.sat + "%,28%,0)");
      } else {
        /* Light mode stays deliberately faint — a warm cast on paper, not a
           coloured wash. Anything stronger reads as a stock gradient. */
        g.addColorStop(0, "hsla(" + L.hue + "," + L.sat + "%,74%," + (0.20 * L.w) + ")");
        g.addColorStop(0.55, "hsla(" + L.hue + "," + (L.sat - 15) + "%,84%," + (0.07 * L.w) + ")");
        g.addColorStop(1, "hsla(" + L.hue + ",40%,95%,0)");
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function loop(now) {
    if (!running) return;
    if (start === null) start = now;
    if (now - lastDraw >= 1000 / FPS) {
      lastDraw = now;
      draw(now - start);
    }
    raf = requestAnimationFrame(loop);
  }

  function play() {
    if (running || !canvas || comfortOn()) return;
    if (prefersReducedMotion()) { draw(0); return; }  /* one still frame, no loop */
    running = true;
    raf = requestAnimationFrame(loop);
  }
  function pause() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }

  function mount() {
    if (comfortOn()) return;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "lightfield";
      canvas.width = W; canvas.height = H;
      canvas.setAttribute("aria-hidden", "true");
      document.body.prepend(canvas);

      var grain = document.createElement("div");
      grain.id = "grain";
      grain.setAttribute("aria-hidden", "true");
      document.body.prepend(grain);

      ctx = canvas.getContext("2d");
    }
    play();
  }
  function unmount() {
    pause();
    if (canvas) { canvas.remove(); canvas = null; ctx = null; }
    var g = document.getElementById("grain");
    if (g) g.remove();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause(); else play();
  });
  /* Theme flips repaint immediately rather than waiting for the next frame,
     so switching light/dark never shows a stale-coloured field. */
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", function () { if (ctx) draw(performance.now() - (start || 0)); });
  }

  return {
    mount: mount,
    unmount: unmount,
    refresh: function () { if (ctx) draw(performance.now() - (start || 0)); },
    setComfort: function (on) { if (on) unmount(); else mount(); }
  };
})();
