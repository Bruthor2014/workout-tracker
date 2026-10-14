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

export function deriveTheme(accent) {
  if (!accent || !/^#[0-9a-fA-F]{6}$/.test(accent)) {
    return { accent: "#a78bfa", accentStrong: "#8b5cf6", bgBase: "#07051f" };
  }
  const [h, s, l] = hexToHsl(accent);
  const accentStrong = hslToHex(h, Math.min(s * 1.08, 100), Math.max(l - 16, 12));
  const bgBase = hslToHex(h, Math.min(s * 0.38, 32), 5.5);
  return { accent, accentStrong, bgBase };
}

export function applyTheme(accentColor) {
  const { accent, accentStrong, bgBase } = deriveTheme(accentColor);
  const root = document.documentElement;
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-strong", accentStrong);
  root.style.setProperty("--bg-base", bgBase);
}

export function resetTheme() {
  const root = document.documentElement;
  root.style.removeProperty("--accent");
  root.style.removeProperty("--accent-strong");
  root.style.removeProperty("--bg-base");
}
