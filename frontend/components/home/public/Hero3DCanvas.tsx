import React, { useEffect, useRef } from "react";

export default function Hero3DCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId = 0;
    let scrollResumeTimer = 0;
    let isVisible = true;
    let isScrolling = false;
    let lastFrameTime = 0;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 600);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || 600;
    };

    window.addEventListener("resize", handleResize);

    // Create 3D points on a sphere / node matrix
    // Keep the decorative canvas cheap enough that it never competes with
    // touch scrolling. Mobile gets fewer nodes and all devices render at 30fps.
    const numPoints = window.matchMedia("(max-width: 820px)").matches ? 42 : 72;
    const points: Array<{ x: number; y: number; z: number; ox: number; oy: number; oz: number; radius: number }> = [];
    const radius = Math.min(width, height) * 0.32;

    for (let i = 0; i < numPoints; i++) {
      const theta = Math.acos(2 * Math.random() - 1);
      const phi = 2 * Math.PI * Math.random();

      const x = radius * Math.sin(theta) * Math.cos(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(theta);

      points.push({
        x,
        y,
        z,
        ox: x,
        oy: y,
        oz: z,
        radius: Math.random() * 2.5 + 1.2,
      });
    }

    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left - width / 2;
      mouseY = e.clientY - rect.top - height / 2;
      targetRotY = (mouseX / width) * 1.5;
      targetRotX = -(mouseY / height) * 1.5;
    };

    window.addEventListener("mousemove", handleMouseMove);

    const angleX = 0.003;
    const angleY = 0.005;

    const render = (time = 0) => {
      animationFrameId = requestAnimationFrame(render);

      if (!isVisible || isScrolling || document.hidden || time - lastFrameTime < 33) {
        return;
      }
      lastFrameTime = time;

      ctx.clearRect(0, 0, width, height);

      currentRotX += (targetRotX - currentRotX) * 0.05;
      currentRotY += (targetRotY - currentRotY) * 0.05;

      const totalRotX = angleX + currentRotX * 0.02;
      const totalRotY = angleY + currentRotY * 0.02;

      const cx = width / 2;
      const cy = height / 2;
      const fov = 400;

      // Draw connection lines
      for (let i = 0; i < points.length; i++) {
        const p = points[i];

        // Rotate Y
        const x1 = p.x * Math.cos(totalRotY) - p.z * Math.sin(totalRotY);
        const z1 = p.z * Math.cos(totalRotY) + p.x * Math.sin(totalRotY);

        // Rotate X
        const y1 = p.y * Math.cos(totalRotX) - z1 * Math.sin(totalRotX);
        const z2 = z1 * Math.cos(totalRotX) + p.y * Math.sin(totalRotX);

        p.x = x1;
        p.y = y1;
        p.z = z2;

        const scale = fov / (fov + p.z + 200);
        const projX = p.x * scale + cx;
        const projY = p.y * scale + cy;

        // Draw connections to nearby points
        for (let j = i + 1; j < points.length; j++) {
          const p2 = points[j];
          const scale2 = fov / (fov + p2.z + 200);
          const projX2 = p2.x * scale2 + cx;
          const projY2 = p2.y * scale2 + cy;

          const dx = projX - projX2;
          const dy = projY - projY2;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 85) {
            const alpha = (1 - dist / 85) * 0.22 * scale;
            ctx.beginPath();
            ctx.moveTo(projX, projY);
            ctx.lineTo(projX2, projY2);
            ctx.strokeStyle = `rgba(37, 99, 235, ${alpha})`;
            ctx.lineWidth = 1 * scale;
            ctx.stroke();
          }
        }

        // Draw point node in soft blue hues
        const alpha = Math.max(0.12, (p.z + radius) / (2 * radius));
        ctx.beginPath();
        ctx.arc(projX, projY, p.radius * scale, 0, Math.PI * 2);
        ctx.fillStyle = p.z > 0 ? `rgba(37, 99, 235, ${alpha})` : `rgba(2, 132, 199, ${alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.z > 0 ? "rgba(37, 99, 235, 0.6)" : "rgba(2, 132, 199, 0.6)";
        ctx.fill();
        ctx.shadowBlur = 0;
      }

    };

    const handleScroll = () => {
      isScrolling = true;
      window.clearTimeout(scrollResumeTimer);
      scrollResumeTimer = window.setTimeout(() => {
        isScrolling = false;
      }, 140);
    };

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { rootMargin: "120px" },
    );

    visibilityObserver.observe(canvas);
    window.addEventListener("scroll", handleScroll, { passive: true });
    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.clearTimeout(scrollResumeTimer);
      visibilityObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return <canvas ref={canvasRef} className="hero-3d-canvas" />;
}
