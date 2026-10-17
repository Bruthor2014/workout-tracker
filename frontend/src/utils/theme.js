function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [0, 8, 4].map((n) => Math.round(f(n) * 255).toString(16).padStart(2, "0")).join("");
}

function hexToRgbString(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

const DEFAULT_PRIMARY = "#a78bfa";
const DEFAULT_SECONDARY = "#6d5bd0";
const isHex = (v) => !!v && /^#[0-9a-fA-F]{6}$/.test(v);

// Deriva TODAS as cores da app (destaque, fundo, sidebar/cartões, borda) a
// partir de só duas cores escolhidas pelo CEO — principal e secundária.
// A principal gera a rampa de destaque (botões, links, glows) que o resto
// do CSS já usava fixa a roxo (--accent/--accent-strong/--accent-deep/
// --accent-light); a secundária domina os fundos e as superfícies "glass"
// (sidebar, cartões), sempre suavizados em saturação/luminosidade para
// que uma cor muito viva (ex: vermelho puro) não "pinte tudo" de forma
// garrida — fica só um tom escuro e discreto, como o roxo original.
export function deriveTheme(primary, secondary) {
  const p = isHex(primary) ? primary : DEFAULT_PRIMARY;
  const s = isHex(secondary) ? secondary : DEFAULT_SECONDARY;

  const [ph, ps] = hexToHsl(p);
  const [sh, ss] = hexToHsl(s);

  const accent = p;
  const accentStrong = hslToHex(ph, Math.min(ps * 1.08, 100), 66);
  const accentDeep = hslToHex(ph, Math.min(ps * 1.1, 100), 50);
  const accentLight = hslToHex(ph, Math.min(ps * 0.9, 100), 85);

  // Superfícies "glass" (cartões, sidebar, inputs): tom escuro e discreto
  // SEMPRE, só a matiz segue a secundária — isto é fundamental para um
  // tema escuro (texto claro por cima). A luminosidade fica praticamente
  // fixa (como o roxo original) porque deixá-la reagir à luminosidade da
  // cor escolhida (ex: branco) acaba por estourar os painéis para um
  // cinza/branco plano, o que parece "partido".
  const mutedSat = Math.min(ss * 0.65, 55);
  const surfaceRgb = hexToRgbString(hslToHex(sh, mutedSat, 20));
  const surfaceStrongRgb = hexToRgbString(hslToHex(sh, mutedSat, 25));
  const bgBase = hslToHex(sh, Math.min(ss * 0.4, 30), 6);
  const glassBg = `rgba(${surfaceRgb}, 0.45)`;
  const glassBgStrong = `rgba(${surfaceStrongRgb}, 0.6)`;
  const glassBorder = hslToHex(ph, Math.min(ps * 0.8, 80), 60) + "2e"; // ~18% alpha

  return {
    accent,
    accentStrong,
    accentDeep,
    accentLight,
    bgBase,
    glassBg,
    glassBgStrong,
    glassBorder,
    surfaceRgb,
    surfaceStrongRgb,
    accentRgb: hexToRgbString(accent),
    accentStrongRgb: hexToRgbString(accentStrong),
    accentDeepRgb: hexToRgbString(accentDeep),
    accentLightRgb: hexToRgbString(accentLight),
    bgImage: `linear-gradient(135deg, ${hslToHex(ph, Math.min(ps * 0.5, 50), 10)}, ${hslToHex(sh, Math.min(ss * 0.5, 50), 7)})`,
  };
}

// Aplica o tema a TODA a app: destaque (botões/links/glows), fundo da
// página (substitui a imagem fixa por um gradiente nas duas cores — não
// há como "pintar" uma imagem estática), sidebar e cartões.
export function applyTheme(primary, secondary) {
  const t = deriveTheme(primary, secondary);
  const root = document.documentElement;
  root.style.setProperty("--accent", t.accent);
  root.style.setProperty("--accent-strong", t.accentStrong);
  root.style.setProperty("--accent-deep", t.accentDeep);
  root.style.setProperty("--accent-light", t.accentLight);
  root.style.setProperty("--accent-rgb", t.accentRgb);
  root.style.setProperty("--accent-strong-rgb", t.accentStrongRgb);
  root.style.setProperty("--accent-deep-rgb", t.accentDeepRgb);
  root.style.setProperty("--accent-light-rgb", t.accentLightRgb);
  root.style.setProperty("--surface-rgb", t.surfaceRgb);
  root.style.setProperty("--surface-strong-rgb", t.surfaceStrongRgb);
  root.style.setProperty("--bg-base", t.bgBase);
  root.style.setProperty("--glass-bg", t.glassBg);
  root.style.setProperty("--glass-bg-strong", t.glassBgStrong);
  root.style.setProperty("--glass-border", t.glassBorder);
  root.style.setProperty("--bg-image", t.bgImage);
}

export function resetTheme() {
  const root = document.documentElement;
  [
    "--accent", "--accent-strong", "--accent-deep", "--accent-light",
    "--accent-rgb", "--accent-strong-rgb", "--accent-deep-rgb", "--accent-light-rgb",
    "--surface-rgb", "--surface-strong-rgb",
    "--bg-base", "--glass-bg", "--glass-bg-strong", "--glass-border", "--bg-image",
  ].forEach((prop) => root.style.removeProperty(prop));
}
