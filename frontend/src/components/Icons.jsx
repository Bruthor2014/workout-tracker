// Conjunto de ícones em linha (SVG), no lugar de emojis — mais consistente
// com o resto do design (cor herdada via currentColor, mesmo traço em
// todos). Cada um aceita className/size como uma tag <svg> normal.

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconDumbbell({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="2" y="9" width="3" height="6" rx="1" />
      <rect x="19" y="9" width="3" height="6" rx="1" />
      <rect x="5" y="7" width="2.5" height="10" rx="1" />
      <rect x="16.5" y="7" width="2.5" height="10" rx="1" />
      <line x1="7.5" y1="12" x2="16.5" y2="12" />
    </svg>
  );
}

export function IconTrendingUp({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <polyline points="3 17 9 11 13 15 21 6" />
      <polyline points="15 6 21 6 21 12" />
    </svg>
  );
}

export function IconClipboard({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <rect x="9" y="2.3" width="6" height="3.4" rx="1" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="16" y2="15" />
    </svg>
  );
}

export function IconBarChart({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <line x1="4" y1="20" x2="20" y2="20" />
      <rect x="5.5" y="12" width="3.2" height="8" rx="0.8" />
      <rect x="10.4" y="7" width="3.2" height="13" rx="0.8" />
      <rect x="15.3" y="3.5" width="3.2" height="16.5" rx="0.8" />
    </svg>
  );
}

export function IconLeaf({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M20 4c-8.5 0-15 5.5-15 14 8.5 0 15-5.5 15-14z" />
      <path d="M5 18c4-4 7-7 12.5-12.5" />
    </svg>
  );
}

export function IconRun({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="14" cy="4.5" r="1.6" />
      <path d="M9 21l2.5-5 2-2.2-1-4-3.5 1.5" />
      <path d="M11.5 13.8L15 12l3 3.5" />
      <path d="M12.5 9.8L10 8l-3.5 1" />
      <path d="M15 12l1.5 6.5 3 1.5" />
    </svg>
  );
}

export function IconBuilding({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="5" y="3" width="10" height="18" rx="1" />
      <rect x="15" y="9" width="5" height="12" rx="1" />
      <line x1="8" y1="7" x2="8" y2="7.01" />
      <line x1="12" y1="7" x2="12" y2="7.01" />
      <line x1="8" y1="11" x2="8" y2="11.01" />
      <line x1="12" y1="11" x2="12" y2="11.01" />
      <line x1="8" y1="15" x2="8" y2="15.01" />
      <line x1="12" y1="15" x2="12" y2="15.01" />
    </svg>
  );
}

export function IconSmartphone({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="6" y="2.5" width="12" height="19" rx="2.4" />
      <line x1="11" y1="18.3" x2="13" y2="18.3" />
    </svg>
  );
}
