"""Converte as figuras musculares de icon-sources/muscles/ (traços brancos
sobre fundo escuro liso) nos ícones usados pela app em
public/icons/muscles/: brancos, fundo transparente, cortados e centrados
num quadrado. Ver src/components/MuscleIcons.jsx.

Uso (a partir de frontend/):  python icon-sources/process_icons.py
Requer: Pillow, numpy
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

SRC = Path(__file__).parent / "muscles"
OUT = Path(__file__).parent.parent / "public" / "icons" / "muscles"
OUT_SIZE = 256
PADDING = 0.06  # margem à volta do desenho, em fração do lado
STROKE_GROW = 3  # px a acrescentar à espessura (os ícones aparecem a ~35px)


def process(path):
    gray = np.asarray(Image.open(path).convert("L")).astype(float)
    background = np.median(gray)
    # Luminância -> alfa: o fundo fica transparente, os traços opacos.
    alpha = np.clip((gray - background - 12) * 255 / (250 - background - 12), 0, 255)

    img = Image.fromarray(alpha.astype("uint8")).filter(ImageFilter.MaxFilter(STROKE_GROW))
    alpha = np.asarray(img.filter(ImageFilter.GaussianBlur(0.6))).astype(float)

    ys, xs = np.nonzero(alpha > 40)
    alpha = alpha[ys.min():ys.max() + 1, xs.min():xs.max() + 1]

    side = int(max(alpha.shape) * (1 + 2 * PADDING))
    square = np.zeros((side, side))
    y0 = (side - alpha.shape[0]) // 2
    x0 = (side - alpha.shape[1]) // 2
    square[y0:y0 + alpha.shape[0], x0:x0 + alpha.shape[1]] = alpha

    mask = Image.fromarray(square.astype("uint8")).resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)
    icon = Image.new("RGBA", (OUT_SIZE, OUT_SIZE), (255, 255, 255, 0))
    icon.putalpha(mask)
    return icon


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for path in sorted(SRC.glob("*.png")):
        process(path).save(OUT / path.name, optimize=True)
        print(path.name, "ok")


if __name__ == "__main__":
    main()
