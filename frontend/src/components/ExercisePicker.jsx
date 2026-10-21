import { useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import GlassCard from "./GlassCard";
import Select from "./Select";
import { IconCamera, IconChevronRight, IconPlusCircle, IconTrash } from "./Icons";
import { muscleGroupVisual, MUSCLE_GROUP_NAMES } from "../utils/muscleGroups";
import { apiRequest } from "../api/client";

const MUSCLE_GROUP_OPTIONS = MUSCLE_GROUP_NAMES.map((name) => ({
  value: name,
  label: name,
  color: muscleGroupVisual(name).color,
}));

// Formulário para criar um exercício pessoal (nome, grupo muscular, foto
// opcional) — só visível para quem o cria, nunca entra no catálogo
// partilhado do ginásio (ver exerciseController.js).
function CreateExerciseForm({ onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // O Modal usa um portal para document.body — o evento "submit" segue a
    // árvore do React (não a do DOM) ao propagar, por isso sem isto também
    // disparava o onSubmit da página por trás (ex: guardar o treino todo).
    e.stopPropagation();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("name", name.trim());
      if (muscleGroup) form.append("muscle_group", muscleGroup);
      if (photo) form.append("photo", photo);
      const created = await apiRequest("/exercises", { method: "POST", body: form });
      onCreated(created);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="exercise-create-form" onSubmit={handleSubmit}>
      <p className="text-secondary" style={{ margin: "0 0 14px" }}>
        Fica só visível para ti — não entra no catálogo do ginásio.
      </p>

      <button type="button" className="exercise-create-photo" onClick={() => fileRef.current?.click()}>
        {preview ? <img src={preview} alt="" /> : <IconCamera size={26} />}
        <span>{preview ? "Trocar foto" : "Adicionar foto (opcional)"}</span>
      </button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} hidden />

      <label className="log-label" htmlFor="new-exercise-name">
        Nome
      </label>
      <input
        id="new-exercise-name"
        type="text"
        className="glass-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ex: Remada Unilateral na Polia"
        autoFocus
        required
      />

      <label className="log-label" htmlFor="new-exercise-group" style={{ marginTop: 12 }}>
        Tipo de exercício
      </label>
      <Select
        id="new-exercise-group"
        value={muscleGroup}
        onChange={setMuscleGroup}
        options={MUSCLE_GROUP_OPTIONS}
        placeholder="Escolhe um grupo muscular..."
        ariaLabel="Tipo de exercício"
      />

      {error && <p className="error-text">{error}</p>}

      <div className="form-actions">
        <button type="button" className="glass-button glass-button-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="glass-button" disabled={saving || !name.trim()}>
          {saving ? "A criar..." : "Criar exercício"}
        </button>
      </div>
    </form>
  );
}

// Mostra a foto real do exercício quando existe (`image_url`, miniaturas em
// public/exercises/ — ver schema.sql); sem isso cai no pictograma do grupo
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
// `onExerciseCreated`/`onExerciseDeleted` (opcionais): avisam a página que
// fornece `exercises` para acrescentar/remover da sua lista — sem o
// primeiro o botão de criar não aparece; sem o segundo, os exercícios
// pessoais não têm o botão de eliminar.
export default function ExercisePicker({ exercises, value, onChange, onExerciseCreated, onExerciseDeleted }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("Todos");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

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

  function handleCreated(exercise) {
    onExerciseCreated?.(exercise);
    setCreating(false);
    pick(exercise);
  }

  async function handleDelete(e, exercise) {
    e.stopPropagation(); // não escolher o exercício ao clicar no lixo
    if (!window.confirm(`Eliminar "${exercise.name}"? Não podes desfazer isto.`)) return;
    setDeletingId(exercise.id);
    try {
      await apiRequest(`/exercises/${exercise.id}`, { method: "DELETE" });
      onExerciseDeleted?.(exercise.id);
      if (String(value) === String(exercise.id)) onChange("");
    } catch (err) {
      window.alert(err.message);
    } finally {
      setDeletingId(null);
    }
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
        <Modal onClose={() => setOpen(false)} className="exercise-picker-modal-wrap">
          <GlassCard className="exercise-picker-modal" strong>
            <div className="exercise-picker-header">
              <h3>{creating ? "Criar exercício" : "Escolher exercício"}</h3>
              {!creating && (
                <span className="text-secondary exercise-picker-count">
                  {filtered.length} {filtered.length === 1 ? "exercício" : "exercícios"}
                </span>
              )}
            </div>

            {creating ? (
              <CreateExerciseForm onCreated={handleCreated} onCancel={() => setCreating(false)} />
            ) : (
              <>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="Pesquisar exercício..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
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
                  {onExerciseCreated && (
                    <button type="button" className="exercise-option-card exercise-option-create" onClick={() => setCreating(true)}>
                      <span className="exercise-option-media">
                        <IconPlusCircle size={32} />
                      </span>
                      <span className="exercise-option-body">
                        <span className="exercise-option-name">Criar exercício</span>
                        <span className="exercise-option-group">O teu, só visível para ti</span>
                      </span>
                    </button>
                  )}
                  {filtered.length === 0 && (
                    <p className="text-secondary exercise-picker-empty">
                      Nenhum exercício encontrado.
                    </p>
                  )}
                  {filtered.map((ex) => {
                    const { icon: Icon, color } = muscleGroupVisual(ex.muscle_group);
                    const canDelete = ex.is_custom && onExerciseDeleted;
                    return (
                      <div
                        key={ex.id}
                        className={`exercise-option-card${String(ex.id) === String(value) ? " selected" : ""}`}
                        style={{ "--exercise-color": color }}
                      >
                        {/* Div, não botão — um exercício pessoal também tem o
                            botão de eliminar por cima, e um <button> não pode
                            conter outro <button> (HTML inválido). */}
                        <button type="button" className="exercise-option-select" onClick={() => pick(ex)}>
                          <span className="exercise-option-media">
                            {ex.image_url ? (
                              <img src={ex.image_url} alt="" width="480" height="320" loading="lazy" decoding="async" />
                            ) : (
                              <Icon size={40} />
                            )}
                            {ex.is_custom && <span className="exercise-option-custom-badge">Teu</span>}
                          </span>
                          <span className="exercise-option-body">
                            <span className="exercise-option-name">{ex.name}</span>
                            {ex.muscle_group && <span className="exercise-option-group">{ex.muscle_group}</span>}
                          </span>
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="exercise-option-delete"
                            onClick={(e) => handleDelete(e, ex)}
                            disabled={deletingId === ex.id}
                            aria-label={`Eliminar ${ex.name}`}
                          >
                            <IconTrash size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="form-actions">
                  <button type="button" className="glass-button glass-button-secondary" onClick={() => setOpen(false)}>
                    Fechar
                  </button>
                </div>
              </>
            )}
          </GlassCard>
        </Modal>
      )}
    </>
  );
}
