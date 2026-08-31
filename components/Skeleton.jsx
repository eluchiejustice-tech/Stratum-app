// Minimal shimmer primitive. Deliberately just a styled div — no
// variants, no animation config, no fake numbers/content baked in.
// Each dashboard composes its own skeleton layout by arranging these
// blocks to loosely match its real structure.
export default function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-[#3D4148]/10 rounded ${className}`} />;
}
