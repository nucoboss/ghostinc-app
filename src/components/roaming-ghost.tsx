"use client";

import { useEffect, useRef } from "react";
import { GhostIcon } from "./ghost-icon";

export function RoamingGhost() {
  const ghostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ghostRef.current;
    if (!element) return;
    const ghost = element;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const width = element.offsetWidth || 220;
    const height = element.offsetHeight || 265;

    if (reduceMotion) {
      ghost.style.transform = `translate3d(${window.innerWidth / 2 - width / 2}px, ${window.innerHeight / 2 - height / 2}px, 0) scale(.9)`;
      return;
    }

    let x = Math.random() * Math.max(window.innerWidth - width, 1);
    let y = Math.random() * Math.max(window.innerHeight - height, 1);
    let heading = Math.random() * Math.PI * 2;
    let turnRate = 0;
    let targetTurnRate = 0;
    let nextDirectionChange = 0;
    let depth = 0.35 + Math.random() * 0.4;
    let targetDepth = depth;
    let nextDepthChange = 0;
    let travelPhase: "roaming" | "vanishing" | "appearing" = "roaming";
    let phaseStartedAt = 0;
    let nextVanishAt = 18000 + Math.random() * 14000;
    let start: number | null = null;
    let last: number | undefined;
    let frame: number;

    function shortestAngle(from: number, to: number) {
      return Math.atan2(Math.sin(to - from), Math.cos(to - from));
    }

    function smoothstep(value: number) {
      const clamped = Math.max(0, Math.min(1, value));
      return clamped * clamped * (3 - 2 * clamped);
    }

    function animate(now: number) {
      if (start === null) start = now;
      const time = now - start;
      const delta = last === undefined ? 16 : Math.min(now - last, 50);
      last = now;

      if (time >= nextDirectionChange) {
        // Long glides alternate with broad turns, without changing travel speed.
        const gliding = Math.random() < 0.35;
        targetTurnRate = (Math.random() * 2 - 1) * (gliding ? 0.000025 : 0.00018);
        nextDirectionChange = time + 4000 + Math.random() * 5000;
      }

      const steeringEase = 1 - Math.exp(-delta / 2400);
      turnRate += (targetTurnRate - turnRate) * steeringEase;
      heading += turnRate * delta;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      const margin = Math.min(140, Math.max(70, Math.min(viewportWidth, viewportHeight) * 0.13));
      const edgePressure = Math.max(
        centerX < margin ? (margin - centerX) / margin : 0,
        centerX > viewportWidth - margin ? (centerX - viewportWidth + margin) / margin : 0,
        centerY < margin ? (margin - centerY) / margin : 0,
        centerY > viewportHeight - margin ? (centerY - viewportHeight + margin) / margin : 0,
      );

      if (edgePressure > 0) {
        const towardCenter = Math.atan2(viewportHeight / 2 - centerY, viewportWidth / 2 - centerX);
        const boundaryEase = (1 - Math.exp(-delta / 1300)) * Math.min(edgePressure, 1.5);
        heading += shortestAngle(heading, towardCenter) * boundaryEase;
      }

      if (time >= nextDepthChange) {
        targetDepth = 0.12 + Math.random() * 0.88;
        nextDepthChange = time + 8000 + Math.random() * 7000;
      }

      depth += (targetDepth - depth) * (1 - Math.exp(-delta / 5500));

      if (travelPhase === "roaming" && time >= nextVanishAt) {
        travelPhase = "vanishing";
        phaseStartedAt = time;
      }

      let visibility = 1;
      let perspectiveScale = 1;
      let visualDepth = depth;

      if (travelPhase === "vanishing") {
        const progress = smoothstep((time - phaseStartedAt) / 3200);
        visibility = 1 - progress;
        perspectiveScale = 1 - progress * 0.72;
        visualDepth = depth * (1 - progress);

        if (progress >= 1) {
          x = Math.random() * Math.max(viewportWidth - width, 1);
          y = Math.random() * Math.max(viewportHeight - height, 1);
          heading = Math.random() * Math.PI * 2;
          turnRate = 0;
          targetTurnRate = 0;
          depth = 0.3 + Math.random() * 0.5;
          targetDepth = depth;
          travelPhase = "appearing";
          phaseStartedAt = time;
          visibility = 0;
          perspectiveScale = 0.28;
          visualDepth = 0;
        }
      } else if (travelPhase === "appearing") {
        const progress = smoothstep((time - phaseStartedAt) / 2400);
        visibility = progress;
        perspectiveScale = 0.28 + progress * 0.72;
        visualDepth = depth * progress;

        if (progress >= 1) {
          travelPhase = "roaming";
          nextVanishAt = time + 20000 + Math.random() * 16000;
        }
      }

      // Distant motion covers less screen space, reinforcing the depth cue.
      const apparentSpeed = 0.026 * (0.58 + visualDepth * 0.42);
      x += Math.cos(heading) * apparentSpeed * delta;
      y += Math.sin(heading) * apparentSpeed * delta;

      const scale = (0.62 + 0.68 * visualDepth) * perspectiveScale;
      const opacity = (0.02 + 0.065 * visualDepth) * visibility;
      const bank = Math.max(-1.8, Math.min(1.8, (turnRate / 0.00018) * 1.8));
      const blur = (1 - visualDepth) * 0.7 + (1 - perspectiveScale) * 2.2;
      ghost.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) rotate(${bank.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      ghost.style.opacity = opacity.toFixed(3);
      ghost.style.filter = `blur(${blur.toFixed(2)}px)`;
      frame = requestAnimationFrame(animate);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        cancelAnimationFrame(frame);
      } else {
        last = undefined;
        frame = requestAnimationFrame(animate);
      }
    }

    frame = requestAnimationFrame(animate);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div ref={ghostRef} className="roaming-ghost" aria-hidden="true">
      <GhostIcon />
    </div>
  );
}
