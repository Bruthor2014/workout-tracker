import { useEffect, useLayoutEffect, useRef } from "react";

const GAP = 6; // distância entre o botão e o popover
const MARGIN = 8; // distância mínima às bordas do ecrã

// Posiciona um popover (lista de opções, calendário...) junto ao elemento
// que o abriu. O popover é renderizado num portal para document.body com
// position: fixed — assim não fica cortado por janelas (Modal) ou cartões
// com scroll. Abre por baixo; se não couber, por cima. Fecha ao clicar fora
// ou com Escape (sem fechar também o Modal onde esteja).
//
// Devolve { anchorRef, popoverRef }: anchorRef no botão, popoverRef no
// elemento do popover (que deve ter position: fixed).
export function useAnchoredPopover(open, onClose) {
  const anchorRef = useRef(null);
  const popoverRef = useRef(null);

  useLayoutEffect(() => {
    if (!open) return undefined;

    // Posicionamento direto no DOM (não em estado), para não haver um
    // render extra nem um frame com o popover no sítio errado.
    function place() {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;
      const a = anchor.getBoundingClientRect();
      popover.style.minWidth = `${a.width}px`;
      const { offsetHeight: h, offsetWidth: w } = popover;
      const fitsBelow = a.bottom + GAP + h <= window.innerHeight - MARGIN;
      const fitsAbove = a.top - GAP - h >= MARGIN;
      const top = fitsBelow || !fitsAbove ? a.bottom + GAP : a.top - GAP - h;
      const left = Math.max(MARGIN, Math.min(a.left, window.innerWidth - w - MARGIN));
      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(e) {
      if (anchorRef.current?.contains(e.target) || popoverRef.current?.contains(e.target)) return;
      onClose();
    }
    // Em fase de captura e com stopPropagation: o Escape fecha só o
    // popover, não o Modal à volta (que escuta o keydown no document).
    function handleKeyDown(e) {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
      anchorRef.current?.focus();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [open, onClose]);

  return { anchorRef, popoverRef };
}
