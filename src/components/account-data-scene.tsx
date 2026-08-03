"use client";

import { useEffect, useRef } from "react";
import { GhostIcon } from "./ghost-icon";

const sources = [
  { className: "source-pjud", name: "PJUD", label: "Causas judiciales", rows: ["ROL · O-1842-2026", "Estado · Tramitación", "Tribunal · Santiago"] },
  { className: "source-sii", name: "SII", label: "Identidad tributaria", rows: ["RUT · 61.502.000-1", "Actividad · Vigente", "Inicio · 1998"] },
  { className: "source-diario", name: "Diario Oficial", label: "Actos societarios", rows: ["Constitución", "Modificación social", "Publicación · 14/07"] },
  { className: "source-boletin", name: "Boletín", label: "Procedimientos concursales", rows: ["Liquidaciones", "Reorganizaciones", "Estado · Sin alertas"] },
];

export function AccountDataScene() {
  const sceneRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    const ghost = ghostRef.current;
    if (!scene || !ghost) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const started = performance.now();

    function animate(now: number) {
      const elapsed = now - started;
      const width = scene!.clientWidth;
      const height = scene!.clientHeight;
      const time = reducedMotion ? 0 : elapsed;
      const autoX = width * (0.5 + 0.29 * Math.sin(time / 5200) + 0.07 * Math.sin(time / 2100));
      const autoY = height * (0.48 + 0.24 * Math.sin(time / 3900 + 1.3));
      const depth = 0.5 + 0.5 * Math.sin(time / 3100 + 0.6);
      const scale = 0.72 + depth * 0.34;
      const z = 35 + depth * 100;
      const tilt = reducedMotion ? 0 : Math.cos(time / 1800) * 3;
      ghost!.style.transform = `translate3d(${autoX.toFixed(1)}px, ${autoY.toFixed(1)}px, ${z.toFixed(1)}px) translate(-50%, -50%) rotate(${tilt.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      ghost!.style.opacity = (0.42 + depth * 0.16).toFixed(2);
      ghost!.style.filter = `drop-shadow(0 16px 22px rgb(0 0 0 / .35)) blur(${((1 - depth) * 0.25).toFixed(2)}px)`;
      frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="data-scene" ref={sceneRef}>
      <div className="scene-caption"><span>Rastreo activo</span></div>
      <div className="data-world">
        <svg className="scene-routes" viewBox="0 0 800 700" aria-hidden="true">
          <path d="M95 170 C280 30 590 85 694 225 S645 535 445 565 S92 525 120 335 S390 105 620 410" />
        </svg>
        {sources.map((source) => (
          <article className={`source-window ${source.className}`} key={source.name} aria-hidden="true">
            <div className="source-browser"><i /><i /><i /><span>{source.name}</span></div>
            <div className="source-body">
              <strong>{source.label}</strong>
              {source.rows.map((row) => <span key={row}>{row}</span>)}
            </div>
          </article>
        ))}
        <div
          className="scene-ghost"
          ref={ghostRef}
          aria-hidden="true"
        >
          <GhostIcon />
        </div>
      </div>
    </div>
  );
}
