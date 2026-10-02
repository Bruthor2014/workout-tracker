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
      <path d="M4 5h16v11H9l-5 4V5z" />
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

// Pictogramas por grupo muscular — usados no seletor de exercícios como
// substituto de uma foto real do movimento (sem capacidade de obter
// imagens reais neste ambiente). Não ilustram o exercício em si, só a zona
// do corpo trabalhada.

export function IconMuscleChest({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 7c1.5-2 4-2 5 0l3 3 3-3c1-2 3.5-2 5 0 1.5 2 1 5-1 7l-7 6-7-6c-2-2-2.5-5-1-7z" />
    </svg>
  );
}

export function IconMuscleBack({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 3v18" />
      <path d="M12 6 4 10l3 11 5-6" />
      <path d="M12 6l8 4-3 11-5-6" />
    </svg>
  );
}

export function IconMuscleLegs({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M9 2h6l1 9-2 2 1 9h-3l-1-9-2 2-1-9-2-2z" />
      <path d="M8 4H5M19 4h-3" />
    </svg>
  );
}

export function IconMuscleShoulders({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="6" cy="8" r="3" />
      <circle cx="18" cy="8" r="3" />
      <path d="M6 11v2a6 6 0 0 0 12 0v-2" />
    </svg>
  );
}

export function IconMuscleArm({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M6 20V11a4 4 0 0 1 4-4c2.5 0 3 2 5 2a3 3 0 0 0 3-3" />
      <path d="M6 20h4" />
    </svg>
  );
}

export function IconMuscleCore({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <rect x="7" y="3" width="10" height="18" rx="3" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="13" x2="17" y2="13" />
      <line x1="7" y1="18" x2="17" y2="18" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  );
}

export function IconMuscleGlutes({ size = 24, className }) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 4c-4 0-7 3-7 8 0 5 3 8 7 8s7-3 7-8c0-5-3-8-7-8z" />
      <line x1="12" y1="5" x2="12" y2="19" />
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
      <path d="M12 2c1.5 3 .5 4.5-.5 6-1.5 2-3 3-3 6a4.5 4.5 0 0 0 9 0c0-2-1-3-1.2-4.6-.1-.8.3-1.4.9-1.9 0 2 .6 3 1.3 3.8A6.5 6.5 0 0 1 12 22a6.5 6.5 0 0 1-6.5-6.5C5.5 10 9 8 12 2z" />
    </svg>
  );
}
