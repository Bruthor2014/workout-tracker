import { forwardRef } from "react";
import { IconApple, IconChevronRight, IconCheck, IconGripVertical } from "./Icons";
import { activeSinceLabel } from "../utils/date";

// Linha compacta de um plano de nutrição (fechado) — só abre os detalhes
// (NutritionPlanCard) ao clicar. A pega (`onDragStart`) arrasta a linha
// para reordenar — ver NutritionPage.jsx, que trata do gesto (Pointer
// Events, funciona a rato e a toque) e manda a ordem final para a API só
// no fim do arrasto.
const NutritionPlanRow = forwardRef(function NutritionPlanRow({ plan, onOpen, handleProps, dragging }, ref) {
  const mealCount = plan.meals.length;
  const foodCount = plan.meals.reduce(
    (sum, meal) => sum + meal.options.reduce((s, option) => s + option.items.length, 0),
    0
  );

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
        <span className="nplan-icon">
          <IconApple size={20} />
        </span>
        <span className="nplan-row-info">
          <span className="nplan-row-name">{plan.name}</span>
          <span className="text-secondary nplan-row-meta">
            {plan.is_active && (
              <span className="nplan-stat-active nplan-row-active">
                <IconCheck size={12} />
                {activeSinceLabel(plan.active_since)}
              </span>
            )}
            {mealCount} {mealCount === 1 ? "refeição" : "refeições"} · {foodCount}{" "}
            {foodCount === 1 ? "alimento" : "alimentos"}
          </span>
        </span>
        <span className="nplan-row-chevron">
          <IconChevronRight size={18} />
        </span>
      </button>
    </div>
  );
});

export default NutritionPlanRow;
