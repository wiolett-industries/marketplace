import { useEffect, useRef, useState } from 'react';
import { useSize } from '../lib/useSize';
import type { ScatterPoint } from '../types';

const PAD = 32;
const DOT = 4;

function colorForSource(source: string): string {
  if (source === 'user_explicit') return '#ff7a18';
  if (source === 'repo_fact') return '#7bd14a';
  if (source === 'tool_result') return '#2bb1ff';
  return '#3fd0c9'; // model_inferred
}

interface Scale {
  sx: (x: number) => number;
  sy: (y: number) => number;
}

function buildScale(points: ScatterPoint[], width: number, height: number): Scale {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  return {
    sx: (x) => PAD + ((x - minX) / spanX) * (width - PAD * 2),
    sy: (y) => height - PAD - ((y - minY) / spanY) * (height - PAD * 2),
  };
}

export function ScatterCanvas({
  points,
  selectedId,
  onSelect,
}: {
  points: ScatterPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}): JSX.Element {
  const [ref, size] = useSize<HTMLDivElement>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<ScatterPoint | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width === 0 || points.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    const scale = buildScale(points, size.width, size.height);

    // Faint instrument crosshair.
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD, size.height / 2);
    ctx.lineTo(size.width - PAD, size.height / 2);
    ctx.moveTo(size.width / 2, PAD);
    ctx.lineTo(size.width / 2, size.height - PAD);
    ctx.stroke();

    for (const point of points) {
      const px = scale.sx(point.x);
      const py = scale.sy(point.y);
      const selected = point.id === selectedId;
      const hovered = hover?.id === point.id;
      ctx.beginPath();
      ctx.arc(px, py, selected ? DOT + 2 : DOT, 0, 2 * Math.PI);
      ctx.fillStyle = selected ? '#ff7a18' : colorForSource(point.source);
      ctx.globalAlpha = hover && !hovered && !selected ? 0.4 : 0.9;
      ctx.fill();
      if (selected || hovered) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#ff7a18';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, DOT + 4, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    if (hover) {
      const px = scale.sx(hover.x);
      const py = scale.sy(hover.y);
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#e6e8ea';
      ctx.textAlign = px > size.width - 120 ? 'right' : 'left';
      ctx.fillText(hover.file_name.slice(0, 32), px + (px > size.width - 120 ? -8 : 8), py - 8);
    }
  }, [points, size, selectedId, hover]);

  const pick = (event: React.MouseEvent): ScatterPoint | null => {
    if (points.length === 0 || size.width === 0) return null;
    const rect = (event.target as HTMLCanvasElement).getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const scale = buildScale(points, size.width, size.height);
    let nearest: ScatterPoint | null = null;
    let best = 12 * 12;
    for (const point of points) {
      const dx = scale.sx(point.x) - mx;
      const dy = scale.sy(point.y) - my;
      const distance = dx * dx + dy * dy;
      if (distance < best) {
        best = distance;
        nearest = point;
      }
    }
    return nearest;
  };

  return (
    <div ref={ref} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        style={{ width: size.width, height: size.height }}
        onMouseMove={(event) => setHover(pick(event))}
        onMouseLeave={() => setHover(null)}
        onClick={(event) => {
          const point = pick(event);
          if (point) onSelect(point.id);
        }}
      />
    </div>
  );
}
