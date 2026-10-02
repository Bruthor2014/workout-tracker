export default function GlassCard({ children, className = "", strong = false, ...rest }) {
  const base = strong ? "glass-strong" : "glass";
  return (
    <div className={`${base} ${className}`} {...rest}>
      {children}
    </div>
  );
}
