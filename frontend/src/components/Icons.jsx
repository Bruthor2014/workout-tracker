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

export function IconPlusCircle({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="9" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export function IconMessage({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-5 4z" />
      <line x1="8.5" y1="9" x2="15.5" y2="9" />
      <line x1="8.5" y1="12.5" x2="13" y2="12.5" />
    </svg>
  );
}

export function IconUsers({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="9" r="2.3" />
      <path d="M15.5 14.2c2.6.5 4.5 2.7 4.5 5.8" />
    </svg>
  );
}

export function IconDownload({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 3v12" />
      <polyline points="7 10 12 15 17 10" />
      <path d="M4 18v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}

export function IconChevronRight({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <polyline points="9 5 16 12 9 19" />
    </svg>
  );
}

// Logótipo da app: uma linha de pulsação que termina em check — ao
// contrário dos restantes ícones (traço, currentColor), este tem gradiente
// próprio fixo, por ser a marca, não um ícone funcional.
export function IconLogoMark({ size = 24, className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" width={size} height={size} className={className}>
      <defs>
        <linearGradient id="logoMarkGradient" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#c026d3" />
        </linearGradient>
      </defs>
      <path
        d="M2 13h5l3.5-8L14 19l8-14"
        stroke="url(#logoMarkGradient)"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCalendar({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="8" y1="2.8" x2="8" y2="6.5" />
      <line x1="16" y1="2.8" x2="16" y2="6.5" />
    </svg>
  );
}

export function IconFilter({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 4h16l-6 8v6l-4 2v-8z" />
    </svg>
  );
}

export function IconRefresh({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 4v5h5" />
      <path d="M20 20v-5h-5" />
      <path d="M5.5 15a7 7 0 0 0 12.3 2.5M18.5 9A7 7 0 0 0 6.2 6.5" />
    </svg>
  );
}

export function IconFlame({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 2.5c.6 3 3.2 4.8 4.6 7.4 1.8 3.3 1 7.6-2 9.6a6.8 6.8 0 0 1-9.2-2.4c-1.6-2.8-.9-6.3 1.4-8.5.1 1.6.8 2.9 2 3.5-.5-3.9 1.1-7.4 3.2-9.6z" />
      <path d="M12 21c-1.7 0-3-1.3-3-3 0-1.9 1.5-3 2.3-4.8 1 1.5 2.6 2.4 3.4 3.9.8 1.7-.1 3.9-2.7 3.9z" />
    </svg>
  );
}

export function IconUtensils({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M6 3v7a2.5 2.5 0 0 0 5 0V3" />
      <line x1="8.5" y1="3" x2="8.5" y2="21" />
      <path d="M18 21V3c-2.2 1-3.5 3.6-3.5 7v3H18" />
    </svg>
  );
}

export function IconClock({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <polyline points="12 7.5 12 12 15 14" />
    </svg>
  );
}

export function IconTrash({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 7h16" />
      <path d="M9.5 7V4.5h5V7" />
      <path d="M6.5 7l1 13h9l1-13" />
      <path d="M10.5 11v5.5M13.5 11v5.5" />
    </svg>
  );
}

export function IconArrowUp({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="6 11 12 5 18 11" />
    </svg>
  );
}

// Discos de peso empilhados — volume total levantado.
export function IconWeightStack({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <ellipse cx="12" cy="6" rx="7.5" ry="2.5" />
      <path d="M4.5 6v3c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5V6" />
      <path d="M4.5 12v3c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-3" />
      <path d="M4.5 18c0 1.4 3.4 2.5 7.5 2.5s7.5-1.1 7.5-2.5v-3" />
      <path d="M4.5 15v3" />
    </svg>
  );
}

export function IconStopwatch({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 13.5V10" />
      <path d="M10 2.5h4M12 2.5V6" />
      <path d="M18.5 6.5l1.5-1.5" />
    </svg>
  );
}

export function IconFileText({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </svg>
  );
}

export function IconNotes({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </svg>
  );
}

export function IconLayers({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <polygon points="12 3 21 8 12 13 3 8 12 3" />
      <polyline points="3 12.5 12 17.5 21 12.5" />
      <polyline points="3 16.5 12 21.5 21 16.5" />
    </svg>
  );
}

export function IconSave({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M5 3h11l4 4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 1-2z" />
      <rect x="8" y="3" width="7" height="5" rx="0.5" />
      <rect x="7" y="13" width="10" height="8" rx="1" />
    </svg>
  );
}

export function IconPlay({ size = 24, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="currentColor">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.4-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" />
    </svg>
  );
}

export function IconSearch({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <line x1="16" y1="16" x2="20.5" y2="20.5" />
    </svg>
  );
}

export function IconCamera({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.3l1.5-2.2h5.4L16.2 7h2.3A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle cx="12" cy="12.8" r="3.3" />
    </svg>
  );
}

export function IconApple({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 7.5c-1.2-1-2.7-1.4-4.2-1C5.3 7.2 4 9.6 4.3 12.6c.4 4 2.9 8.4 5.6 8.4.8 0 1.4-.4 2.1-.4s1.3.4 2.1.4c2.7 0 5.2-4.4 5.6-8.4.3-3-1-5.4-3.5-6.1-1.5-.4-3 0-4.2 1z" />
      <path d="M12 7.5c0-2 1-3.6 2.8-4.3" />
    </svg>
  );
}

export function IconCoffee({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M8 3.5c-.6.8-.6 1.7 0 2.5M11.5 3.5c-.6.8-.6 1.7 0 2.5" />
      <path d="M4 21h14" />
    </svg>
  );
}

export function IconMoon({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
    </svg>
  );
}

export function IconPencil({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M15.5 4.5l4 4L8 20H4v-4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

export function IconCheck({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className} strokeWidth={2.4}>
      <polyline points="5 12.5 10 17.5 19 7" />
    </svg>
  );
}

export function IconTrophy({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a2.5 2.5 0 0 0 3 4M16 6h3a2.5 2.5 0 0 1-3 4" />
      <path d="M12 13v4M9 20.5h6M10 17h4l.5 3.5h-5z" />
    </svg>
  );
}
