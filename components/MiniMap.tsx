"use client";

import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type MapPoint = { lat: number; lng: number; color: string };

function project(lat: number, lng: number, zoom: number) {
  const scale = 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const radians = (lat * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2 * scale;
  return { x, y };
}

function frameAt(points: { lat: number; lng: number }[], zoom: number) {
  const projected = points.map((point) => project(point.lat, point.lng, zoom));
  const padX = 0.28;
  const padY = 0.22;
  const minX = Math.min(...projected.map((point) => point.x)) - padX;
  const maxX = Math.max(...projected.map((point) => point.x)) + padX;
  const minY = Math.min(...projected.map((point) => point.y)) - padY;
  const maxY = Math.max(...projected.map((point) => point.y)) + padY;
  return {
    minX,
    minY,
    spanX: Math.max(0.8, maxX - minX),
    spanY: Math.max(0.55, maxY - minY),
  };
}

function chooseZoom(points: { lat: number; lng: number }[], width: number, height: number, maxTileCss: number) {
  let zoom = 13;
  for (let level = 13; level <= 18; level += 1) {
    const frame = frameAt(points, level);
    const scale = Math.min(width / frame.spanX, height / frame.spanY);
    zoom = level;
    if (scale <= maxTileCss) break;
  }
  return zoom;
}

export function MiniMap({
  points,
  path = [],
  dropPath = [],
  ratio: preferred = 0.5,
  maxHeight,
  minHeight,
  interactive = false,
  road = false,
}: {
  points: MapPoint[];
  path?: { lat: number; lng: number }[];
  dropPath?: { lat: number; lng: number }[];
  ratio?: number;
  maxHeight?: number;
  minHeight?: number;
  interactive?: boolean;
  road?: boolean;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const goal = useRef(0);
  const shown = useRef(0);
  const motion = useRef(0);
  const [width, setWidth] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [extra, setExtra] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const nudge = useCallback((delta: number) => {
    goal.current = Math.min(3, Math.max(0, goal.current + delta));
    if (goal.current === 0) setPan({ x: 0, y: 0 });
    if (motion.current) return;
    const tick = () => {
      const diff = goal.current - shown.current;
      if (Math.abs(diff) < 0.004) {
        shown.current = goal.current;
        setExtra(shown.current);
        motion.current = 0;
        return;
      }
      shown.current += diff * 0.07;
      setExtra(shown.current);
      motion.current = requestAnimationFrame(tick);
    };
    motion.current = requestAnimationFrame(tick);
  }, []);

  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const node = frame.current;
    if (!node || !interactive) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const step = Math.sign(event.deltaY) * Math.min(0.08, Math.abs(event.deltaY) / 900);
      nudge(-step);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(motion.current);
    };
  }, [interactive, nudge]);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div ref={frame} className={interactive ? "minimap interactive" : "minimap"} style={{ height: maxHeight ?? minHeight ?? 160 }} />;
  }

  let target = preferred;
  if (width > 0 && (maxHeight || minHeight)) {
    let height = width * preferred;
    if (maxHeight) height = Math.min(height, maxHeight);
    if (minHeight) height = Math.max(height, Math.min(minHeight, maxHeight ?? minHeight));
    target = height / width;
  }

  const boxW = width || 640;
  let boxH = boxW * target;
  if (maxHeight) boxH = Math.min(boxH, maxHeight);
  if (minHeight) boxH = Math.max(boxH, Math.min(minHeight, maxHeight ?? minHeight));
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const narrow = width > 0 && width < 520;
  const heightCap = narrow && maxHeight ? Math.min(maxHeight, 260) : maxHeight;
  if (heightCap) boxH = Math.min(boxH, heightCap);
  const bounds = path.length + dropPath.length > 1 ? [...points, ...path, ...dropPath] : points;
  const maxTileCss = 256 / dpr;
  const fitZoom = bounds.length ? chooseZoom(bounds, boxW, boxH, maxTileCss) : 15;
  const level = Math.min(18, fitZoom + extra);
  const zoom = Math.min(18, Math.floor(level));
  const sub = level - zoom;
  const fitted = bounds.length ? frameAt(bounds, fitZoom) : { minX: 0, minY: 0, spanX: 1, spanY: target };
  let { minX, minY, spanX, spanY } = fitted;
  const contentRatio = spanY / spanX;
  if (contentRatio > target) {
    const needed = spanY / target;
    minX -= (needed - spanX) / 2;
    spanX = needed;
  } else if (contentRatio < target) {
    const needed = spanX * target;
    minY -= (needed - spanY) / 2;
    spanY = needed;
  }
  const fitScale = Math.min(boxW / spanX, boxH / spanY);
  const factor = 2 ** (level - fitZoom);
  const tileFactor = 2 ** (zoom - fitZoom);
  const viewSpanX = spanX / factor;
  const viewSpanY = spanY / factor;
  const centerX = minX + spanX / 2 - pan.x / (fitScale * factor);
  const centerY = minY + spanY / 2 - pan.y / (fitScale * factor);
  const viewMinX = (centerX - viewSpanX / 2) * tileFactor;
  const viewMinY = (centerY - viewSpanY / 2) * tileFactor;
  const scale = fitScale * 2 ** sub;
  const offsetX = (boxW - spanX * fitScale) / 2;
  const offsetY = (boxH - spanY * fitScale) / 2;
  const coverX = spanX / 2 ** sub;
  const coverY = spanY / 2 ** sub;
  const tiles = [];
  for (let x = Math.floor(viewMinX); x <= Math.floor(viewMinX + coverX); x += 1) {
    for (let y = Math.floor(viewMinY); y <= Math.floor(viewMinY + coverY); y += 1) {
      tiles.push({ x, y });
    }
  }
  const place = (x: number, y: number) => ({ left: offsetX + (x - viewMinX) * scale, top: offsetY + (y - viewMinY) * scale });
  const projected = points.map((point) => project(point.lat, point.lng, zoom));
  const route = path.map((point) => project(point.lat, point.lng, zoom));
  const drop = dropPath.map((point) => project(point.lat, point.lng, zoom));
  const ready = width > 0 || (!maxHeight && !minHeight);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!interactive || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    const limit = Math.max(boxW, boxH);
    setPan({
      x: Math.min(limit, Math.max(-limit, start.panX + event.clientX - start.x)),
      y: Math.min(limit, Math.max(-limit, start.panY + event.clientY - start.y)),
    });
  }

  function endDrag() {
    drag.current = null;
  }

  return (
    <div
      ref={frame}
      className={interactive ? "minimap interactive" : "minimap"}
      style={ready ? { height: boxH } : { height: maxHeight ?? minHeight ?? 160 }}
      onPointerDown={(event) => startDrag(event)}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {tiles.map((tile) => {
        const spot = place(tile.x, tile.y);
        return (
          <img
            key={`${zoom}-${tile.x}-${tile.y}`}
            alt=""
            loading="lazy"
            decoding="async"
            src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
            style={{ left: spot.left, top: spot.top, width: scale + 1, height: scale + 1 }}
          />
        );
      })}
      {route.length > 1 || drop.length > 1 || projected.length > 1 ? (
        <svg className="minimap-draw" viewBox={`0 0 ${boxW} ${boxH}`} aria-hidden="true">
          {route.length > 1 ? (
            <polyline
              fill="none"
              points={route.map((point) => {
                const spot = place(point.x, point.y);
                return `${spot.left},${spot.top}`;
              }).join(" ")}
            />
          ) : !road && projected.length > 1 && drop.length < 2 ? (
            <line
              x1={place(projected[0].x, projected[0].y).left}
              y1={place(projected[0].x, projected[0].y).top}
              x2={place(projected[1].x, projected[1].y).left}
              y2={place(projected[1].x, projected[1].y).top}
            />
          ) : null}
          {drop.length > 1 ? (
            <polyline
              className="drop"
              fill="none"
              points={drop.map((point) => {
                const spot = place(point.x, point.y);
                return `${spot.left},${spot.top}`;
              }).join(" ")}
            />
          ) : null}
        </svg>
      ) : null}
      {interactive ? (
        <div className="map-zoom">
          <button type="button" aria-label="Acercar" onClick={() => nudge(0.16)}>+</button>
          <button type="button" aria-label="Alejar" onClick={() => nudge(-0.16)}>−</button>
        </div>
      ) : null}
      {projected.map((point, index) => {
        const spot = place(point.x, point.y);
        return <i key={`${points[index].lat}-${points[index].lng}-${index}`} className="pin" style={{ left: spot.left, top: spot.top, background: points[index].color }} />;
      })}
    </div>
  );
}
