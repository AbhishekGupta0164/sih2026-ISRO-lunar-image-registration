import React, { useRef, useEffect } from "react";

interface OverlayCanvasProps {
  refUrl?: string;
  srcUrl?: string;
  opacity?: number;
  mode?: "blend" | "difference" | "checkerboard";
}

export default function OverlayCanvas({
  refUrl,
  srcUrl,
  opacity = 0.5,
  mode = "blend",
}: OverlayCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [refUrl, srcUrl, opacity, mode]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
      <canvas ref={canvasRef} className="w-full h-full object-contain" />
    </div>
  );
}
