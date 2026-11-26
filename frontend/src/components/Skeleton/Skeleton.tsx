import type { ReactNode } from "react";
import type { SkeletonProps } from "../../types/ui";
import { useDelayedFlag } from "../../hooks/useDelayedFlag";
import styles from "./Skeleton.module.css";

const SHAPE_DEFAULTS: Record<NonNullable<SkeletonProps["shape"]>, { width: number | string; height: number | string; radius: SkeletonProps["radius"] }> = {
  text: { width: "80%", height: 14, radius: undefined },
  gauge: { width: 200, height: 200, radius: "full" },
  tile: { width: "100%", height: 96, radius: "lg" },
  row: { width: "100%", height: 64, radius: "md" },
  chart: { width: "100%", height: 220, radius: "md" },
};

/** One placeholder block. Shapes mirror the real layout so nothing jumps when data arrives. */
export function Skeleton({ width, height, radius, shape }: SkeletonProps) {
  const d = shape ? SHAPE_DEFAULTS[shape] : { width: "100%", height: 14, radius: undefined };
  const r = radius ?? d.radius;
  return (
    <span
      className={[styles.skel, shape === "gauge" && styles.gauge, r && styles[r]].filter(Boolean).join(" ")}
      style={{ width: width ?? d.width, height: height ?? d.height }}
      aria-hidden="true"
    />
  );
}

/** Varied text lines (60–90% wide). */
export function SkeletonLines({ count = 3, height = 14 }: { count?: number; height?: number }) {
  const widths = ["90%", "70%", "82%", "60%", "76%"];
  return (
    <span className={styles.lines} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} width={widths[i % widths.length]} height={height} />
      ))}
    </span>
  );
}

/** A list row: icon tile plus two lines (directives, tasks, settings rows). */
export function SkeletonRow() {
  return (
    <span className={styles.row} aria-hidden="true">
      <Skeleton width={40} height={40} radius="md" />
      <span className={styles.lines}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="90%" height={12} />
      </span>
    </span>
  );
}

/**
 * Loading region: aria-busy with a visually hidden message. The skeleton only
 * appears after 300 ms; before that the region renders nothing.
 */
export function SkeletonRegion({
  loading,
  label,
  children,
  fallback,
  className,
}: {
  loading: boolean;
  /** e.g. "Loading your dashboard". */
  label: string;
  /** The skeleton layout. */
  fallback: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const show = useDelayedFlag(loading, 300);
  if (!loading) return <>{children}</>;
  return (
    <div className={[styles.region, className].filter(Boolean).join(" ")} aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      {show ? fallback : null}
    </div>
  );
}
