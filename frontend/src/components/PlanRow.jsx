import { forwardRef } from "react";
import { IconDumbbell, IconChevronRight, IconGripVertical } from "./Icons";
import { resolveAssetUrl } from "../api/client";

// Linha compacta de um plano de treino (fechado) — só abre os detalhes
// (PlanCard) ao clicar. Mesmo padrão de NutritionPlanRow.jsx: a pega
// (`onDragStart`) arrasta a linha para reordenar — ver PlansPage.jsx, que
// trata do gesto (Pointer Events, funciona a rato e a toque) e manda a
// ordem final para a API só no fim do arrasto.
const PlanRow = forwardRef(function PlanRow({ plan, onOpen, handleProps, dragging }, ref) {
  const exerciseCount = plan.days.reduce((sum, day) => sum + day.exercises.length, 0);
  const photoUrl = resolveAssetUrl(plan.photo_url);

  return (
    <div ref={ref} className={`nplan-row${dragging ? " dragging" : ""}`}>
      <button
        type="button"
        className="nplan-row-handle"
        aria-label={`Arrastar para reordenar "${plan.name}"`}
        {...handleProps}
      >
        <IconGripVertical size={18} />
      </button>

      <button type="button" className="nplan-row-open" onClick={onOpen}>
        {photoUrl ? (
          <span className="nplan-icon plan-icon plan-cover-photo">
            <img src={photoUrl} alt="" />
          </span>
        ) : (
          <span className="nplan-icon plan-icon">
            <IconDumbbell size={20} />
          </span>
        )}
        <span className="nplan-row-info">
          <span className="nplan-row-name">{plan.name}</span>
          <span className="text-secondary nplan-row-meta">
            {plan.days.length} {plan.days.length === 1 ? "dia" : "dias"} · {exerciseCount}{" "}
            {exerciseCount === 1 ? "exercício" : "exercícios"}
          </span>
        </span>
        <span className="nplan-row-chevron">
          <IconChevronRight size={18} />
        </span>
      </button>
    </div>
  );
});

export default PlanRow;
