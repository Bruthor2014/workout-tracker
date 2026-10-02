import { useMemo, useState } from "react";
import Modal from "./Modal";
import GlassCard from "./GlassCard";
import { IconChevronRight } from "./Icons";
import { muscleGroupVisual } from "../utils/muscleGroups";

// Mostra a foto real do exercício quando existe (`image_url`, obtida da API
// pública da wger.de — ver schema.sql); sem isso cai no pictograma do grupo
// muscular como alternativa.
function ExerciseThumb({ exercise, size = 28 }) {
  if (exercise?.image_url) {
    return (
      <span className="exercise-thumb" style={{ width: size, height: size }}>
        <img src={exercise.image_url} alt="" />
      </span>
    );
  }
  const { icon: Icon, color } = muscleGroupVisual(exercise?.muscle_group);
  return (
    <span className="exercise-icon-chip" style={{ "--exercise-color": color, width: size, height: size }}>
      <Icon size={Math.round(size * 0.55)} />
    </span>
  );
}

// Substitui o <select> simples de escolher exercício por um seletor com
// pesquisa + filtro por grupo muscular, mostrando a foto do exercício
// quando existe (ver ExerciseThumb) ou o pictograma do grupo muscular.
export default function ExercisePicker({ exercises, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("Todos");

  const muscleGroups = useMemo(() => {
    const groups = new Set(exercises.map((ex) => ex.muscle_group).filter(Boolean));
    return ["Todos", ...Array.from(groups).sort()];
  }, [exercises]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      const matchesMuscle = muscleFilter === "Todos" || ex.muscle_group === muscleFilter;
      const matchesSearch = !term || ex.name.toLowerCase().includes(term);
      return matchesMuscle && matchesSearch;
    });
  }, [exercises, search, muscleFilter]);

  const selected = exercises.find((ex) => String(ex.id) === String(value));

  function pick(exercise) {
    onChange(String(exercise.id));
    setOpen(false);
    setSearch("");
  }

  return (
    <>
      <button type="button" className="glass-input exercise-picker-trigger" onClick={() => setOpen(true)}>
        {selected ? (
          <span className="exercise-picker-trigger-selected">
            <ExerciseThumb exercise={selected} />
            {selected.name}
          </span>
        ) : (
          <span className="text-secondary">Escolhe um exercício...</span>
        )}
        <span style={{ display: "inline-flex", transform: "rotate(90deg)" }}>
          <IconChevronRight size={16} />
        </span>
      </button>

      {open && (
        <Modal onClose={() => setOpen(false)}>
          <GlassCard className="preview-card exercise-picker-modal" strong>
            <h3>Escolher exercício</h3>

            <input
              type="text"
              className="glass-input"
              placeholder="Pesquisar exercício..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginTop: 14 }}
              autoFocus
            />

            <div className="muscle-filter-row">
              {muscleGroups.map((group) => {
                const active = group === muscleFilter;
                const visual = group === "Todos" ? null : muscleGroupVisual(group);
                return (
                  <button
                    type="button"
                    key={group}
                    className={`muscle-filter-chip${active ? " active" : ""}`}
                    style={visual ? { "--exercise-color": visual.color } : undefined}
                    onClick={() => setMuscleFilter(group)}
                  >
                    {group}
                  </button>
                );
              })}
            </div>

            <div className="exercise-option-grid">
              {filtered.length === 0 && (
                <p className="text-secondary" style={{ gridColumn: "1 / -1" }}>
                  Nenhum exercício encontrado.
                </p>
              )}
              {filtered.map((ex) => (
                <button
                  type="button"
                  key={ex.id}
                  className={`exercise-option-card${String(ex.id) === String(value) ? " selected" : ""}`}
                  onClick={() => pick(ex)}
                >
                  <ExerciseThumb exercise={ex} size={56} />
                  <div>
                    <span className="exercise-option-name">{ex.name}</span>
                    {ex.muscle_group && <span className="text-secondary">{ex.muscle_group}</span>}
                  </div>
                </button>
              ))}
            </div>

            <div className="form-actions">
              <button type="button" className="glass-button glass-button-secondary" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </div>
          </GlassCard>
        </Modal>
      )}
    </>
  );
}
