import { useEffect } from "react";
import { createPortal } from "react-dom";

// Overlay simples: fundo escurecido + conteúdo centrado. Fecha ao clicar
// fora ou com Escape. Renderizado via portal para `document.body` —
// `position: fixed` deixa de cobrir o ecrã inteiro quando o Modal é
// aberto a partir de um sítio aninhado dentro de um `.glass`/`.glass-strong`
// (o `backdrop-filter` dessas classes cria um containing block para os
// descendentes fixed, confinando o overlay à caixa desse antepassado em vez
// do viewport) — um portal evita este problema seja qual for o sítio a
// partir de onde o Modal é aberto.
export default function Modal({ onClose, children }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
