import { useState } from "react";
import { IconInfo } from "./Icons";

// Ícone pequeno de "i" que, ao clicar, mostra uma caixa curta de texto por
// baixo — para explicações que não precisam de estar sempre visíveis (ex:
// o que conta para cada ranking). O backdrop invisível fecha ao clicar
// fora, sem precisar de um listener de click global.
export default function InfoTooltip({ text }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="info-tooltip">
      <button
        type="button"
        className="info-tooltip-trigger"
        onClick={() => setOpen((o) => !o)}
        aria-label="Mais informação"
        aria-expanded={open}
      >
        <IconInfo size={15} />
      </button>
      {open && (
        <>
          <span className="info-tooltip-backdrop" onClick={() => setOpen(false)} />
          {/* Sem role="tooltip" de propósito — isso é para conteúdo
              transitório ativado por hover/foco; isto é um "disclosure"
              (abre/fecha por clique, fica até se clicar fora), por isso o
              estado vive no aria-expanded do botão, não aqui. */}
          <span className="info-tooltip-box">{text}</span>
        </>
      )}
    </span>
  );
}
