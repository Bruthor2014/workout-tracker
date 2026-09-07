export default function GlassCard({ children, className = "", strong = false }) {
  const base = strong ? "glass-strong" : "glass";
  return <div className={`${base} ${className}`}>{children}</div>;
}
