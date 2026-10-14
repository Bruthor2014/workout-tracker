import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconChevronRight } from "./Icons";
import { useAnchoredPopover } from "../utils/useAnchoredPopover";

// Lista de escolha no estilo do site, no lugar do <select> nativo (cujo
// menu aberto segue o aspeto do sistema operativo e não dá para estilizar).
// `options`: [{ value, label, description?, color? }] — `color` mostra um
// ponto de cor, `description` uma linha de explicação por baixo.
// Teclado: ↑/↓ para navegar, Enter/Espaço para escolher, Escape para fechar.
export default function Select({
  id,
  value,
  onChange,
  options,
  placeholder = "Escolhe...",
  ariaLabel,
  className = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const close = useCallback(() => setOpen(false), []);
  const { anchorRef, popoverRef } = useAnchoredPopover(open, close);

  const selectedIndex = options.findIndex((o) => String(o.value) === String(value ?? ""));
  const selected = options[selectedIndex];

  function openList() {
    setActiveIndex(Math.max(0, selectedIndex));
    setOpen(true);
  }

  function choose(option) {
    onChange(option.value);
    setOpen(false);
    anchorRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) e.preventDefault();
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) openList();
      return;
    }
    if (e.key === "ArrowDown") setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    else if (e.key === "ArrowUp") setActiveIndex((i) => Math.max(0, i - 1));
    else if ((e.key === "Enter" || e.key === " ") && options[activeIndex]) choose(options[activeIndex]);
    else if (e.key === "Tab") close();
  }

  // A opção ativa (teclado) fica sempre visível na lista.
  useEffect(() => {
    if (!open) return;
    popoverRef.current?.querySelector(`[data-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex, popoverRef]);

  return (
    <div className={`ui-select ${className}`}>
      <button
        ref={anchorRef}
        id={id}
        type="button"
        className={`ui-select-trigger${open ? " open" : ""}`}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        style={selected?.color ? { "--option-color": selected.color } : undefined}
      >
        {selected?.color && <span className="ui-select-dot" />}
        <span className={`ui-select-value${selected ? "" : " placeholder"}`}>{selected ? selected.label : placeholder}</span>
        <span className="ui-select-chevron">
          <IconChevronRight size={16} />
        </span>
      </button>

      {open &&
        createPortal(
          <div ref={popoverRef} className="ui-popover ui-select-list" role="listbox" aria-label={ariaLabel}>
            {options.map((option, index) => (
              <button
                type="button"
                key={String(option.value)}
                data-index={index}
                role="option"
                aria-selected={index === selectedIndex}
                tabIndex={-1}
                className={`ui-select-option${index === activeIndex ? " active" : ""}${
                  index === selectedIndex ? " selected" : ""
                }`}
                style={option.color ? { "--option-color": option.color } : undefined}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
              >
                {option.color && <span className="ui-select-dot" />}
                <span className="ui-select-option-text">
                  <span className="ui-select-option-label">{option.label}</span>
                  {option.description && <span className="ui-select-option-description">{option.description}</span>}
                </span>
                {index === selectedIndex && (
                  <span className="ui-select-check">
                    <IconCheck size={15} />
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}
