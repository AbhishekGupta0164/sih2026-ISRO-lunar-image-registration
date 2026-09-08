import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Grid, Eye, Layers, Sparkles, RefreshCw, Palette } from 'lucide-react';

interface CheckerboardCanvasProps {
  refUrl: string;
  warpedUrl: string;
  refLabel?: string;
  warpedLabel?: string;
}

export const CheckerboardCanvas: React.FC<CheckerboardCanvasProps> = ({
  refUrl,
  warpedUrl,
  refLabel = 'Reference: LRO NAC (Fixed)',
  warpedLabel = 'Registered: TPS Warped Output',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Configuration state
  const [gridSize, setGridSize] = useState<number>(8);
  const [showGridLines, setShowGridLines] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [tintMode, setTintMode] = useState<'none' | 'subtle' | 'contrast'>('subtle');
  const [inverted, setInverted] = useState<boolean>(false);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [blinkState, setBlinkState] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Cached Image elements
  const refImgRef = useRef<HTMLImageElement | null>(null);
  const warpedImgRef = useRef<HTMLImageElement | null>(null);

  // Load images
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    const imgRef = new Image();
    imgRef.crossOrigin = 'anonymous';

    const imgWarped = new Image();
    imgWarped.crossOrigin = 'anonymous';

    let loadedCount = 0;
    const checkDone = () => {
      loadedCount++;
      if (loadedCount === 2 && !isCancelled) {
        refImgRef.current = imgRef;
        warpedImgRef.current = imgWarped;
        setLoading(false);
      }
    };

    imgRef.onload = checkDone;
    imgRef.onerror = () => {
      console.warn('Could not load ref image in CheckerboardCanvas:', refUrl);
      checkDone();
    };

    imgWarped.onload = checkDone;
    imgWarped.onerror = () => {
      console.warn('Could not load warped image in CheckerboardCanvas:', warpedUrl);
      checkDone();
    };

    imgRef.src = refUrl;
    imgWarped.src = warpedUrl;

    return () => {
      isCancelled = true;
    };
  }, [refUrl, warpedUrl]);

  // Blink interval
  useEffect(() => {
    if (!isBlinking) return;
    const interval = setInterval(() => {
      setBlinkState((prev) => !prev);
    }, 600);
    return () => clearInterval(interval);
  }, [isBlinking]);

  // Draw Checkerboard on Canvas
  const drawCheckerboard = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgRef = refImgRef.current;
    const imgWarped = warpedImgRef.current;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth || 800;
    const displayHeight = canvas.clientHeight || 460;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const W = displayWidth;
    const H = displayHeight;

    // Dark background
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, W, H);

    if (!imgRef || !imgWarped || imgRef.width === 0 || imgWarped.width === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Loading rasters for 8×8 checkerboard rendering…', W / 2, H / 2);
      ctx.restore();
      return;
    }

    // Determine square fitting viewport
    const size = Math.min(W, H) - 16;
    const offsetX = (W - size) / 2;
    const offsetY = (H - size) / 2;

    const N = gridSize;
    const sqSize = size / N;

    // Create temporary offscreen canvases for crisp slicing
    const refOffscreen = document.createElement('canvas');
    refOffscreen.width = size;
    refOffscreen.height = size;
    const refCtx = refOffscreen.getContext('2d');
    if (refCtx) {
      refCtx.drawImage(imgRef, 0, 0, size, size);
    }

    const warpedOffscreen = document.createElement('canvas');
    warpedOffscreen.width = size;
    warpedOffscreen.height = size;
    const warpedCtx = warpedOffscreen.getContext('2d');
    if (warpedCtx) {
      warpedCtx.drawImage(imgWarped, 0, 0, size, size);
    }

    // Render alternating tiles
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let isRefTile = (r + c) % 2 === 0;
        if (inverted) isRefTile = !isRefTile;

        // If in blink mode, alternate full view
        if (isBlinking) {
          isRefTile = blinkState;
        }

        const sx = c * sqSize;
        const sy = r * sqSize;
        const dx = offsetX + sx;
        const dy = offsetY + sy;

        const sourceCanvas = isRefTile ? refOffscreen : warpedOffscreen;

        // Draw tile
        ctx.drawImage(sourceCanvas, sx, sy, sqSize, sqSize, dx, dy, sqSize, sqSize);

        // Apply tint if active
        if (tintMode === 'subtle') {
          ctx.fillStyle = isRefTile ? 'rgba(56, 189, 248, 0.08)' : 'rgba(52, 211, 153, 0.08)';
          ctx.fillRect(dx, dy, sqSize, sqSize);
        } else if (tintMode === 'contrast') {
          ctx.fillStyle = isRefTile ? 'rgba(56, 189, 248, 0.16)' : 'rgba(251, 191, 36, 0.16)';
          ctx.fillRect(dx, dy, sqSize, sqSize);
        }

        // Draw tile labels if enabled and tile is big enough
        if (showLabels && sqSize >= 36) {
          const badgeText = isRefTile ? 'REF' : 'WARP';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          ctx.fillStyle = isRefTile ? 'rgba(15, 23, 42, 0.85)' : 'rgba(6, 78, 59, 0.85)';
          ctx.fillRect(dx + 2, dy + 2, isRefTile ? 26 : 32, 13);

          ctx.fillStyle = isRefTile ? '#38bdf8' : '#34d399';
          ctx.fillText(badgeText, dx + 4, dy + 3);
        }
      }
    }

    // Draw high-visibility grid lines
    if (showGridLines) {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1;

      for (let i = 0; i <= N; i++) {
        const x = offsetX + i * sqSize;
        const y = offsetY + i * sqSize;

        // Vertical line
        ctx.beginPath();
        ctx.moveTo(x, offsetY);
        ctx.lineTo(x, offsetY + size);
        ctx.stroke();

        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(offsetX, y);
        ctx.lineTo(offsetX + size, y);
        ctx.stroke();
      }

      // Outer bounding box highlight
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(offsetX, offsetY, size, size);
    }

    ctx.restore();
  }, [gridSize, showGridLines, showLabels, tintMode, inverted, isBlinking, blinkState]);

  useEffect(() => {
    drawCheckerboard();
  }, [drawCheckerboard, loading]);

  useEffect(() => {
    const handleResize = () => drawCheckerboard();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawCheckerboard]);

  return (
    <div className="space-y-4">
      {/* CONTROLS BAR */}
      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3 text-xs">
        {/* GRID RESOLUTION SELECTOR */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Grid className="w-4 h-4 text-sky-500" />
            <span>Grid:</span>
          </span>
          <div className="flex items-center bg-slate-200 dark:bg-slate-900 rounded-lg p-0.5 border border-slate-300 dark:border-slate-800">
            {[4, 8, 16, 32].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGridSize(g)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono font-bold transition-all ${
                  gridSize === g
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {g}×{g}
              </button>
            ))}
          </div>
        </div>

        {/* TOGGLES */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* GRID LINES TOGGLE */}
          <button
            type="button"
            onClick={() => setShowGridLines((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              showGridLines
                ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Grid Borders</span>
          </button>

          {/* TILE BADGES TOGGLE */}
          <button
            type="button"
            onClick={() => setShowLabels((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              showLabels
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Tile Labels</span>
          </button>

          {/* SENSOR TINT TOGGLE */}
          <button
            type="button"
            onClick={() => {
              setTintMode((prev) => (prev === 'none' ? 'subtle' : prev === 'subtle' ? 'contrast' : 'none'));
            }}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              tintMode !== 'none'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
            }`}
            title="Sensor modal tinting"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Tint: {tintMode}</span>
          </button>

          {/* INVERT TILES */}
          <button
            type="button"
            onClick={() => setInverted((prev) => !prev)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-[11px] font-semibold flex items-center gap-1.5 transition-all"
            title="Invert alternating tile assignment"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Swap</span>
          </button>

          {/* BLINK COMPARISON */}
          <button
            type="button"
            onClick={() => setIsBlinking((prev) => !prev)}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-all ${
              isBlinking
                ? 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/30 animate-pulse'
                : 'bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
            title="Alternate entire image to inspect boundary shifts"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isBlinking ? 'Blinking…' : 'Blink Compare'}</span>
          </button>
        </div>
      </div>

      {/* CANVAS CONTAINER */}
      <div className="relative h-[480px] w-full rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 flex items-center justify-center shadow-2xl">
        <canvas
          ref={canvasRef}
          className="w-full h-full block cursor-crosshair"
          title="8×8 Interleaved Lunar Registration Checkerboard"
        />

        {/* LEGEND BADGES IN CORNERS */}
        <div className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-sky-500/40 text-[11px] font-mono font-bold text-sky-400 shadow-lg flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
          <span>{refLabel}</span>
        </div>
        <div className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-slate-950/90 border border-emerald-500/40 text-[11px] font-mono font-bold text-emerald-400 shadow-lg flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span>{warpedLabel}</span>
        </div>
      </div>
    </div>
  );
};
