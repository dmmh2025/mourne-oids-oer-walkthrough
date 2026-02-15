"use client";

import {
  type CSSProperties,
  type PropsWithChildren,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type HoverCardProps = PropsWithChildren<{
  anchorRect: DOMRect | null;
  open: boolean;
  title: string;
  loading?: boolean;
  error?: string | null;
  className?: string;
  offset?: number;
  zIndex?: number;
}>;

type Position = {
  top: number;
  left: number;
};

const VIEWPORT_PADDING = 8;

export function HoverCard({
  anchorRect,
  open,
  title,
  loading = false,
  error = null,
  className,
  children,
  offset = 8,
  zIndex = 40,
}: HoverCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRect || !cardRef.current) {
      setPosition(null);
      return;
    }

    const cardRect = cardRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const desiredLeft = anchorRect.left;
    const desiredTop = anchorRect.bottom + offset;

    const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - cardRect.width - VIEWPORT_PADDING);
    const maxTop = Math.max(VIEWPORT_PADDING, viewportHeight - cardRect.height - VIEWPORT_PADDING);

    setPosition({
      left: Math.min(Math.max(desiredLeft, VIEWPORT_PADDING), maxLeft),
      top: Math.min(Math.max(desiredTop, VIEWPORT_PADDING), maxTop),
    });
  }, [anchorRect, offset, open, children, error, loading, title]);

  const style = useMemo<CSSProperties | undefined>(() => {
    if (!open || !anchorRect || !position) return undefined;

    return {
      position: "fixed",
      top: position.top,
      left: position.left,
      zIndex,
      minWidth: 240,
      maxWidth: "min(420px, calc(100vw - 16px))",
      background: "#fff",
      border: "1px solid #d8dde6",
      borderRadius: 10,
      boxShadow: "0 10px 30px rgba(0, 0, 0, 0.15)",
      padding: 12,
    };
  }, [anchorRect, open, position, zIndex]);

  if (!open || !anchorRect) {
    return null;
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-live="polite"
      className={className}
      style={style}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>{title}</div>
      {loading ? <div>Loading…</div> : null}
      {!loading && error ? (
        <div style={{ color: "#b91c1c" }} role="alert">
          {error}
        </div>
      ) : null}
      {!loading && !error ? children : null}
    </div>
  );
}
