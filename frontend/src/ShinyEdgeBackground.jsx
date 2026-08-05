import { useEffect, useRef, useState } from "react";

/**
 * ShinyEdgeBackground
 * -------------------
 * Renders a full-screen background image and adds a soft, cursor-following
 * "light" that only becomes visible along the actual edges of the image
 * (e.g. the facets of a low-poly triangle background), fading in when you
 * move near an edge and fading out when the cursor moves away.
 *
 * Usage:
 *   1. Drop your background image in your `public/` folder, e.g. public/triangles-bg.jpg
 *   2. <ShinyEdgeBackground imageSrc="/triangles-bg.jpg" />
 *   3. Render your page content in a wrapper with `position: relative; z-index: 1`
 *      (or Tailwind's `relative z-10`) so it sits above this fixed background.
 */
export default function ShinyEdgeBackground({
  imageSrc = "/triangles-bg.jpg",
  radius = 200, // px radius of the spotlight, at CSS pixel scale
  intensity = 1.6, // multiplier on edge brightness (raise if edges look too dim)
}) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const edgeCanvasRef = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999, targetOpacity: 0, opacity: 0 });
  const rafRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Load the image once and pre-compute a Sobel edge map for it.
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      imgRef.current = img;

      // Cap the working resolution for the edge pass so this stays fast
      // even on large source images.
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;
      const offCtx = off.getContext("2d");
      offCtx.drawImage(img, 0, 0, w, h);
      const src = offCtx.getImageData(0, 0, w, h);

      // Grayscale
      const gray = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) {
        const r = src.data[i * 4];
        const g = src.data[i * 4 + 1];
        const b = src.data[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }

      // Sobel gradient magnitude
      const mags = new Float32Array(w * h);
      let maxMag = 1;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          const gx =
            -gray[idx - w - 1] - 2 * gray[idx - 1] - gray[idx + w - 1] +
            gray[idx - w + 1] + 2 * gray[idx + 1] + gray[idx + w + 1];
          const gy =
            -gray[idx - w - 1] - 2 * gray[idx - w] - gray[idx - w + 1] +
            gray[idx + w - 1] + 2 * gray[idx + w] + gray[idx + w + 1];
          const mag = Math.sqrt(gx * gx + gy * gy);
          mags[idx] = mag;
          if (mag > maxMag) maxMag = mag;
        }
      }

      // Build a white edge map: alpha encodes edge strength, RGB stays white
      // so the "lighter" blend mode later reads as a bright shine.
      const edgeData = offCtx.createImageData(w, h);
      for (let i = 0; i < w * h; i++) {
        const strength = Math.min(255, (mags[i] / maxMag) * 255 * intensity);
        edgeData.data[i * 4] = 255;
        edgeData.data[i * 4 + 1] = 255;
        edgeData.data[i * 4 + 2] = 255;
        edgeData.data[i * 4 + 3] = strength;
      }

      const edgeCanvas = document.createElement("canvas");
      edgeCanvas.width = w;
      edgeCanvas.height = h;
      edgeCanvas.getContext("2d").putImageData(edgeData, 0, 0);
      edgeCanvasRef.current = edgeCanvas;

      setReady(true);
    };
    img.onerror = () => setFailed(true);
    img.src = imageSrc;

    return () => {
      cancelled = true;
    };
  }, [imageSrc, intensity]);

  // Draw + animate once everything is ready.
  useEffect(() => {
    if (!ready) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    }
    resize();
    window.addEventListener("resize", resize);

    // Draw an image "cover" style (like CSS background-size: cover)
    function drawCover(context, image, cw, ch) {
      const ir = image.width / image.height;
      const cr = cw / ch;
      let dw, dh, dx, dy;
      if (ir > cr) {
        dh = ch;
        dw = ch * ir;
        dx = (cw - dw) / 2;
        dy = 0;
      } else {
        dw = cw;
        dh = cw / ir;
        dx = 0;
        dy = (ch - dh) / 2;
      }
      context.drawImage(image, dx, dy, dw, dh);
      return { dx, dy, dw, dh };
    }

    function loop() {
      const cw = canvas.width;
      const ch = canvas.height;
      ctx.clearRect(0, 0, cw, ch);

      const geom = drawCover(ctx, imgRef.current, cw, ch);

      // Smoothly lerp the glow's opacity toward its target (fade in/out).
      mouse.current.opacity +=
        (mouse.current.targetOpacity - mouse.current.opacity) * 0.08;

      if (mouse.current.opacity > 0.01) {
        const temp = document.createElement("canvas");
        temp.width = cw;
        temp.height = ch;
        const tctx = temp.getContext("2d");

        // Place the pre-computed edge map at the same position/scale as
        // the visible background image.
        tctx.drawImage(edgeCanvasRef.current, geom.dx, geom.dy, geom.dw, geom.dh);

        // Mask it down to a soft circle around the cursor.
        tctx.globalCompositeOperation = "destination-in";
        const r = radius * dpr;
        const grad = tctx.createRadialGradient(
          mouse.current.x, mouse.current.y, 0,
          mouse.current.x, mouse.current.y, r
        );
        grad.addColorStop(0, `rgba(255,255,255,${mouse.current.opacity})`);
        grad.addColorStop(1, "rgba(255,255,255,0)");
        tctx.fillStyle = grad;
        tctx.fillRect(0, 0, cw, ch);

        // Additively blend the masked edges onto the base image so only
        // edges near the cursor light up, like catching a glint.
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(temp, 0, 0);
        ctx.globalCompositeOperation = "source-over";
      }

      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    function handleMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouse.current.x = (e.clientX - rect.left) * (canvas.width / rect.width);
      mouse.current.y = (e.clientY - rect.top) * (canvas.height / rect.height);
      mouse.current.targetOpacity = 1;
    }
    function handleLeave() {
      mouse.current.targetOpacity = 0;
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseleave", handleLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
    };
  }, [ready, radius]);

  return (
    <div className="fixed inset-0 -z-10 bg-black overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {!ready && !failed && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm">
          Loading background…
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-sm px-6 text-center">
          Couldn't load "{imageSrc}". Make sure the image is in your public/ folder
          and the path matches.
        </div>
      )}
    </div>
  );
}