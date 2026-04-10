"use client";

import { useRef, useState, useEffect, useCallback } from "react";

export interface Stroke {
  points: { x: number; y: number; pressure: number }[];
  color: string;
  width: number;
  tool: "pen" | "highlighter" | "eraser";
}

interface DrawingCanvasProps {
  strokes: Stroke[];
  onChange: (strokes: Stroke[]) => void;
  className?: string;
}

const PEN_COLORS = [
  { name: "Black", value: "#2c2c2c", dark: "#e0ddd8" },
  { name: "Red", value: "#c45c5c", dark: "#e07070" },
  { name: "Blue", value: "#5c7cc4", dark: "#7090d4" },
  { name: "Green", value: "#5ca05c", dark: "#70b870" },
  { name: "Gold", value: "#c49a6c", dark: "#d4a574" },
];

const PEN_SIZES = [1, 2, 4, 8];
const HIGHLIGHTER_SIZES = [12, 20, 30];

export default function DrawingCanvas({ strokes, onChange, className }: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [tool, setTool] = useState<"pen" | "highlighter" | "eraser">("pen");
  const [penColor, setPenColor] = useState(0);
  const [penSize, setPenSize] = useState(2);
  const [highlighterSize, setHighlighterSize] = useState(20);
  const [showToolbar, setShowToolbar] = useState(true);

  // Detect dark mode
  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  const getColor = useCallback(() => {
    if (tool === "eraser") return "transparent";
    if (tool === "highlighter") {
      const c = PEN_COLORS[penColor];
      return isDark ? c.dark + "40" : c.value + "40";
    }
    const c = PEN_COLORS[penColor];
    return isDark ? c.dark : c.value;
  }, [tool, penColor, isDark]);

  const getWidth = useCallback(() => {
    if (tool === "eraser") return 20;
    if (tool === "highlighter") return HIGHLIGHTER_SIZES[Math.min(highlighterSize, HIGHLIGHTER_SIZES.length - 1)] || 20;
    return PEN_SIZES[Math.min(penSize, PEN_SIZES.length - 1)] || 2;
  }, [tool, penSize, highlighterSize]);

  // Resize canvas to match container
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = rect.height + "px";
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        redraw(ctx, rect.width, rect.height);
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  function redraw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    ctx.clearRect(0, 0, w, h);
    for (const stroke of strokes) {
      drawStroke(ctx, stroke);
    }
  }

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.points.length < 2) return;
    ctx.save();

    if (stroke.tool === "highlighter") {
      ctx.globalCompositeOperation = "multiply";
      ctx.lineCap = "square";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
    }

    ctx.lineJoin = "round";
    ctx.strokeStyle = stroke.color;

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i];
      // Pressure-sensitive width
      const pressureWidth = stroke.width * (0.5 + p.pressure * 0.8);
      ctx.lineWidth = pressureWidth;
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function getPointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure || 0.5,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    // Only draw with pen/touch, not mouse right-click
    if (e.button !== 0) return;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.setPointerCapture(e.pointerId);
    }

    const pos = getPointerPos(e);

    if (tool === "eraser") {
      // Erase strokes near this point
      eraseAt(pos.x, pos.y);
      setIsDrawing(true);
      return;
    }

    const stroke: Stroke = {
      points: [pos],
      color: getColor(),
      width: getWidth(),
      tool,
    };
    setCurrentStroke(stroke);
    setIsDrawing(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;

    const pos = getPointerPos(e);

    if (tool === "eraser") {
      eraseAt(pos.x, pos.y);
      return;
    }

    if (!currentStroke) return;

    const updated = {
      ...currentStroke,
      points: [...currentStroke.points, pos],
    };
    setCurrentStroke(updated);

    // Live draw on canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const pts = updated.points;
        if (pts.length >= 2) {
          ctx.save();
          if (updated.tool === "highlighter") {
            ctx.globalCompositeOperation = "multiply";
            ctx.lineCap = "square";
          } else {
            ctx.globalCompositeOperation = "source-over";
            ctx.lineCap = "round";
          }
          ctx.lineJoin = "round";
          ctx.strokeStyle = updated.color;
          const p1 = pts[pts.length - 2];
          const p2 = pts[pts.length - 1];
          ctx.lineWidth = updated.width * (0.5 + p2.pressure * 0.8);
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function handlePointerUp() {
    if (currentStroke && currentStroke.points.length >= 2) {
      onChange([...strokes, currentStroke]);
    }
    setCurrentStroke(null);
    setIsDrawing(false);
  }

  function eraseAt(x: number, y: number) {
    const threshold = 15;
    const remaining = strokes.filter((stroke) => {
      return !stroke.points.some(
        (p) => Math.abs(p.x - x) < threshold && Math.abs(p.y - y) < threshold
      );
    });
    if (remaining.length !== strokes.length) {
      onChange(remaining);
      // Redraw
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (canvas && container) {
        const ctx = canvas.getContext("2d");
        const rect = container.getBoundingClientRect();
        if (ctx) redraw(ctx, rect.width, rect.height);
      }
    }
  }

  function clearAll() {
    onChange([]);
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (canvas && container) {
      const ctx = canvas.getContext("2d");
      const rect = container.getBoundingClientRect();
      if (ctx) ctx.clearRect(0, 0, rect.width, rect.height);
    }
  }

  function undo() {
    if (strokes.length === 0) return;
    onChange(strokes.slice(0, -1));
  }

  return (
    <div ref={containerRef} className={`absolute inset-0 ${className || ""}`} style={{ touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Floating drawing toolbar */}
      {showToolbar && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-card/95 backdrop-blur-sm border border-border rounded-xl px-2 py-1.5 shadow-lg z-10">
          {/* Tool selection */}
          <button
            onClick={() => setTool("pen")}
            className={`p-1.5 rounded-lg transition-colors ${tool === "pen" ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"}`}
            title="Pen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
            </svg>
          </button>
          <button
            onClick={() => setTool("highlighter")}
            className={`p-1.5 rounded-lg transition-colors ${tool === "highlighter" ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"}`}
            title="Highlighter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          </button>
          <button
            onClick={() => setTool("eraser")}
            className={`p-1.5 rounded-lg transition-colors ${tool === "eraser" ? "bg-accent/20 text-accent" : "text-muted-foreground hover:text-foreground"}`}
            title="Eraser"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L14.4 2l7.1 7.1c.8.8.8 2 0 2.8L16 17.3"/>
            </svg>
          </button>

          <div className="h-5 w-px bg-border mx-1" />

          {/* Colors */}
          {tool !== "eraser" && (
            <>
              {PEN_COLORS.map((c, idx) => (
                <button
                  key={c.name}
                  onClick={() => setPenColor(idx)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${penColor === idx ? "border-accent scale-110" : "border-transparent hover:border-muted-foreground/30"}`}
                  style={{ backgroundColor: isDark ? c.dark : c.value }}
                  title={c.name}
                />
              ))}
              <div className="h-5 w-px bg-border mx-1" />
            </>
          )}

          {/* Size */}
          {tool === "pen" && PEN_SIZES.map((s, idx) => (
            <button
              key={s}
              onClick={() => setPenSize(idx)}
              className={`p-1.5 rounded-lg transition-colors ${penSize === idx ? "bg-foreground/10" : "hover:bg-foreground/5"}`}
              title={`${s}px`}
            >
              <div className="rounded-full bg-foreground" style={{ width: Math.max(s * 1.5, 4), height: Math.max(s * 1.5, 4) }} />
            </button>
          ))}
          {tool === "highlighter" && HIGHLIGHTER_SIZES.map((s, idx) => (
            <button
              key={s}
              onClick={() => setHighlighterSize(idx)}
              className={`px-1.5 py-0.5 text-[10px] rounded transition-colors ${highlighterSize === idx ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {s}
            </button>
          ))}

          <div className="h-5 w-px bg-border mx-1" />

          {/* Undo / Clear */}
          <button onClick={undo} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors" title="Undo">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 7"/>
            </svg>
          </button>
          <button onClick={clearAll} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors" title="Clear all">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
          </button>
        </div>
      )}

      {/* Toggle toolbar visibility */}
      <button
        onClick={() => setShowToolbar(!showToolbar)}
        className="absolute top-3 right-3 p-1.5 rounded-lg bg-card/80 backdrop-blur-sm border border-border text-muted-foreground hover:text-foreground transition-colors z-10"
        title={showToolbar ? "Hide tools" : "Show tools"}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          {showToolbar ? (
            <><path d="M5 12h14"/></>
          ) : (
            <><path d="M12 5v14"/><path d="M5 12h14"/></>
          )}
        </svg>
      </button>
    </div>
  );
}
