import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal";
import GlassCard from "./GlassCard";
import Select from "./Select";
import {
  IconBookmark,
  IconCamera,
  IconCheck,
  IconChevronRight,
  IconFilter,
  IconPencil,
  IconPlusCircle,
  IconTrash,
} from "./Icons";
import { muscleGroupVisual, MUSCLE_GROUP_NAMES } from "../utils/muscleGroups";
import { apiRequest } from "../api/client";
import { useAnchoredPopover } from "../utils/useAnchoredPopover";

const MUSCLE_GROUP_OPTIONS = MUSCLE_GROUP_NAMES.map((name) => ({
  value: name,
  label: name,
  color: muscleGroupVisual(name).color,
}));

// Mesmos valores do CHECK em exercises.equipment (ver schema.sql) — rótulo
// em português, valor guardado em slug.
const EQUIPMENT_LABELS = {
  barra: "Barra",
  halteres: "Halteres",
  cabo: "Cabo",
  maquina: "Máquina",
  peso_corporal: "Peso do corpo",
  kettlebell: "Kettlebell",
  elastico: "Elástico",
  outro: "Outro",
};
const EQUIPMENT_OPTIONS = Object.entries(EQUIPMENT_LABELS).map(([value, label]) => ({ value, label }));

// Formulário para criar um exercício pessoal (nome, grupo muscular, foto
// opcional) — só visível para quem o cria, nunca entra no catálogo
// partilhado do ginásio (ver exerciseController.js).
function CreateExerciseForm({ onCreated, onCancel }) {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
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
      if (equipment) form.append("equipment", equipment);
      if (videoUrl.trim()) form.append("video_url", videoUrl.trim());
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

      <label className="log-label" htmlFor="new-exercise-equipment" style={{ marginTop: 12 }}>
        Equipamento (opcional)
      </label>
      <Select
        id="new-exercise-equipment"
        value={equipment}
        onChange={setEquipment}
        options={EQUIPMENT_OPTIONS}
        placeholder="Escolhe o equipamento..."
        ariaLabel="Equipamento"
      />

      <label className="log-label" htmlFor="new-exercise-video" style={{ marginTop: 12 }}>
        Link de vídeo de execução (opcional)
      </label>
      <input
        id="new-exercise-video"
        type="url"
        className="glass-input"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="Ex: https://youtube.com/..."
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

// Editar o link de vídeo de um exercício pessoal já existente — campo
// único, pré-preenchido se já houver um. Só funciona em exercícios do
// próprio (PATCH /exercises/:id/video, ver exerciseController.js); o
// catálogo do ginásio não tem ainda nenhum mecanismo de edição.
function EditVideoForm({ exercise, onSaved, onCancel }) {
  const [videoUrl, setVideoUrl] = useState(exercise.video_url || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    setError("");
    try {
      const updated = await apiRequest(`/exercises/${exercise.id}/video`, {
        method: "PATCH",
        body: { video_url: videoUrl.trim() },
      });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="exercise-create-form" onSubmit={handleSubmit}>
      <label className="log-label" htmlFor="edit-exercise-video">
        Link de vídeo de execução de "{exercise.name}"
      </label>
      <input
        id="edit-exercise-video"
        type="url"
        className="glass-input"
        value={videoUrl}
        onChange={(e) => setVideoUrl(e.target.value)}
        placeholder="Ex: https://youtube.com/..."
        autoFocus
      />
      {error && <p className="error-text">{error}</p>}
      <div className="form-actions">
        <button type="button" className="glass-button glass-button-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="glass-button" disabled={saving}>
          {saving ? "A guardar..." : "Guardar"}
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

// Botão "?" no canto do cartão — ao clicar, mostra o link de vídeo de
// execução (se houver) ou avisa que não há nenhum, em vez de o botão só
// desaparecer quando falta o vídeo. Usa o Modal (portal para
// document.body) em vez de uma caixa posicionada dentro do cartão — o
// cartão tem overflow:hidden (para a foto respeitar os cantos
// arredondados) e cortava a caixa sempre que não cabia dentro da sua
// própria largura, sobretudo em telemóvel com 2 colunas (cartões
// estreitos, caixa de 200px). Mesmo stopPropagation para não escolher o
// exercício ao interagir com o botão.
function ExerciseInfoButton({ exercise }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="exercise-option-info-trigger"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Informação sobre ${exercise.name}`}
        aria-expanded={open}
      >
        ?
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <GlassCard strong className="exercise-info-modal">
            {exercise.video_url ? (
              <a
                className="glass-button"
                href={exercise.video_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                Ver vídeo de execução
              </a>
            ) : (
              <p className="text-secondary exercise-info-modal-empty">Sem vídeo disponível.</p>
            )}
          </GlassCard>
        </Modal>
      )}
    </>
  );
}

// Ícone de filtro que abre uma lista (mesmo popover do Select.jsx, via
// useAnchoredPopover) para escolher o equipamento — em vez de uma fila de
// chips sempre visível, só aparece a escolha depois de clicar no ícone.
function EquipmentFilterButton({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { anchorRef, popoverRef } = useAnchoredPopover(open, close);
  const active = value !== "Todos";

  function choose(eq) {
    onChange(eq);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        className={`muscle-filter-chip equipment-filter-chip${active ? " active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filtrar por equipamento"
      >
        <IconFilter size={13} />
        {active ? EQUIPMENT_LABELS[value] || value : "Equipamento"}
      </button>
      {open &&
        createPortal(
          <div ref={popoverRef} className="ui-popover ui-select-list" role="listbox" aria-label="Equipamento">
            {options.map((eq) => (
              <button
                type="button"
                key={eq}
                role="option"
                aria-selected={eq === value}
                className={`ui-select-option${eq === value ? " selected" : ""}`}
                onClick={() => choose(eq)}
              >
                <span className="ui-select-option-text">
                  <span className="ui-select-option-label">
                    {eq === "Todos" ? "Todo o equipamento" : EQUIPMENT_LABELS[eq] || eq}
                  </span>
                </span>
                {eq === value && (
                  <span className="ui-select-check">
                    <IconCheck size={15} />
                  </span>
                )}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
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
  const [equipmentFilter, setEquipmentFilter] = useState("Todos");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [editingVideo, setEditingVideo] = useState(null); // exercício a editar o vídeo
  // video_url/is_favorite editados ficam só localmente aqui (não são
  // avisados ao `exercises` do componente-pai) — evitaria ter de
  // acrescentar mais um callback tipo onExerciseCreated/onExerciseDeleted
  // em todos os sítios que usam este seletor (são 8). Voltam a ficar certos
  // sozinhos da próxima vez que a página recarregar a lista de exercícios.
  const [videoOverrides, setVideoOverrides] = useState({});
  const [favoriteOverrides, setFavoriteOverrides] = useState({});

  const effectiveExercises = useMemo(
    () =>
      exercises.map((ex) => ({
        ...ex,
        video_url: ex.id in videoOverrides ? videoOverrides[ex.id] : ex.video_url,
        is_favorite: ex.id in favoriteOverrides ? favoriteOverrides[ex.id] : ex.is_favorite,
      })),
    [exercises, videoOverrides, favoriteOverrides]
  );

  const muscleGroups = useMemo(() => {
    const groups = new Set(effectiveExercises.map((ex) => ex.muscle_group).filter(Boolean));
    return ["Todos", ...Array.from(groups).sort()];
  }, [effectiveExercises]);

  const equipmentValues = useMemo(() => {
    const values = new Set(effectiveExercises.map((ex) => ex.equipment).filter(Boolean));
    return ["Todos", ...Array.from(values).sort()];
  }, [effectiveExercises]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return effectiveExercises.filter((ex) => {
      const matchesMuscle = muscleFilter === "Todos" || ex.muscle_group === muscleFilter;
      const matchesEquipment = equipmentFilter === "Todos" || ex.equipment === equipmentFilter;
      const matchesFavorite = !favoritesOnly || ex.is_favorite;
      const matchesSearch = !term || ex.name.toLowerCase().includes(term);
      return matchesMuscle && matchesEquipment && matchesFavorite && matchesSearch;
    });
  }, [effectiveExercises, search, muscleFilter, equipmentFilter, favoritesOnly]);

  const selected = effectiveExercises.find((ex) => String(ex.id) === String(value));

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

  function handleVideoSaved(exercise) {
    setVideoOverrides((prev) => ({ ...prev, [exercise.id]: exercise.video_url }));
    setEditingVideo(null);
  }

  async function handleToggleFavorite(e, exercise) {
    e.stopPropagation(); // não escolher o exercício ao clicar no marcador
    try {
      const result = await apiRequest(`/exercises/${exercise.id}/favorite`, { method: "POST" });
      setFavoriteOverrides((prev) => ({ ...prev, [exercise.id]: result.is_favorite }));
    } catch (err) {
      window.alert(err.message);
    }
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
          <span className="text-secondary">Exercício</span>
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
                  <button
                    type="button"
                    className={`muscle-filter-chip exercise-favorite-chip${favoritesOnly ? " active" : ""}`}
                    onClick={() => setFavoritesOnly((f) => !f)}
                    aria-pressed={favoritesOnly}
                  >
                    <IconBookmark size={13} filled={favoritesOnly} /> Favoritos
                  </button>
                  {equipmentValues.length > 1 && (
                    <EquipmentFilterButton
                      options={equipmentValues}
                      value={equipmentFilter}
                      onChange={setEquipmentFilter}
                    />
                  )}
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
                        {/* Div, não botão — o cartão também tem outros botões
                            por cima (favorito, info, editar, eliminar), e um
                            <button> não pode conter outro <button> (HTML
                            inválido). */}
                        <button type="button" className="exercise-option-select" onClick={() => pick(ex)}>
                          <span className="exercise-option-media">
                            {ex.image_url ? (
                              <img src={ex.image_url} alt="" width="480" height="320" loading="lazy" decoding="async" />
                            ) : (
                              <Icon size={40} />
                            )}
                          </span>
                          <span className="exercise-option-body">
                            <span className="exercise-option-name">{ex.name}</span>
                            {(ex.muscle_group || ex.is_custom) && (
                              <span className="exercise-option-group">
                                {ex.muscle_group}
                                {ex.is_custom && <span className="exercise-option-custom-badge">Teu</span>}
                              </span>
                            )}
                          </span>
                        </button>

                        <button
                          type="button"
                          className={`exercise-option-favorite${ex.is_favorite ? " active" : ""}`}
                          onClick={(e) => handleToggleFavorite(e, ex)}
                          aria-label={ex.is_favorite ? `Remover ${ex.name} dos favoritos` : `Adicionar ${ex.name} aos favoritos`}
                          aria-pressed={ex.is_favorite}
                        >
                          <IconBookmark size={15} filled={ex.is_favorite} />
                        </button>

                        <ExerciseInfoButton exercise={ex} />

                        {ex.is_custom && (
                          <div className="exercise-option-owner-actions">
                            <button
                              type="button"
                              className="exercise-option-edit-video"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingVideo(ex);
                              }}
                              aria-label={`Editar vídeo de ${ex.name}`}
                            >
                              <IconPencil size={13} />
                            </button>
                            {canDelete && (
                              <button
                                type="button"
                                className="exercise-option-delete"
                                onClick={(e) => handleDelete(e, ex)}
                                disabled={deletingId === ex.id}
                                aria-label={`Eliminar ${ex.name}`}
                              >
                                <IconTrash size={13} />
                              </button>
                            )}
                          </div>
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

      {editingVideo && (
        <Modal onClose={() => setEditingVideo(null)}>
          <GlassCard strong>
            <EditVideoForm
              exercise={editingVideo}
              onSaved={handleVideoSaved}
              onCancel={() => setEditingVideo(null)}
            />
          </GlassCard>
        </Modal>
      )}
    </>
  );
}
