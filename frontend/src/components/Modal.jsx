import { useEffect } from "react";
import { createPortal } from "react-dom";

// Quantos Modals estão abertos agora (pode haver mais do que um ao mesmo
// tempo, ex: o de confirmar o nome por cima do de login) — só destrava o
// scroll da página de fundo quando o último fechar, nunca antes disso.
let openModalCount = 0;

// Overlay simples: fundo escurecido + conteúdo centrado. Fecha ao clicar
// fora ou com Escape. Renderizado via portal para `document.body` —
// `position: fixed` deixa de cobrir o ecrã inteiro quando o Modal é
// aberto a partir de um sítio aninhado dentro de um `.glass`/`.glass-strong`
// (o `backdrop-filter` dessas classes cria um containing block para os
// descendentes fixed, confinando o overlay à caixa desse antepassado em vez
// do viewport) — um portal evita este problema seja qual for o sítio a
// partir de onde o Modal é aberto.
export default function Modal({ onClose, children, className = "" }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Trava o scroll da página por trás enquanto o modal está aberto — sem
  // isto, a barra de scroll da própria página ficava visível/ativa ao lado
  // do modal, por cima de tudo.
  useEffect(() => {
    if (openModalCount === 0) document.body.style.overflow = "hidden";
    openModalCount += 1;
    return () => {
      openModalCount -= 1;
      if (openModalCount === 0) document.body.style.overflow = "";
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal-content ${className}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
