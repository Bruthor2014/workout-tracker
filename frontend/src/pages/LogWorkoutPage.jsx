import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import WorkoutExerciseBlock from "../components/WorkoutExerciseBlock";
import AchievementToast from "../components/AchievementToast";
import Select from "../components/Select";
import DatePicker from "../components/DatePicker";
import {
  IconBarChart,
  IconDumbbell,
  IconFileText,
  IconLayers,
  IconNotes,
  IconPlay,
  IconPlusCircle,
  IconSave,
  IconStopwatch,
} from "../components/Icons";
import { apiRequest } from "../api/client";
import { toDateKey } from "../utils/date";
import { formatReps } from "../utils/reps";
import { setTypeInfo } from "../utils/setTypes";
import { CARDIO_GROUP } from "../utils/muscleGroups";

// O formulário trabalha com exercícios, cada um com a sua técnica ("normal",
// "drop", "rest_pause"... — ver utils/setTypes.js) e as suas séries; a API continua a receber/devolver uma
// lista plana de séries (exercise_id, reps, weight, set_type), convertida à
// entrada (groupSetsByExercise) e à saída (handleSubmit). `key` é só para
// o React identificar cada bloco ao remover um exercício do meio da lista.
// Cada série tem ainda `done` (marcada como feita com ✓ — só no ecrã) e,
// quando vem de um plano, `repsHint`/`weightHint` com o alvo, mostrado
// como fundo dos campos (os valores em si ficam por preencher).
let nextExerciseKey = 1;
const emptySet = () => ({ reps: "", weight: "", repsHint: "", weightHint: "", done: false });
const newExercise = (exerciseId = "", sets = [emptySet()], type = "normal") => ({
  key: nextExerciseKey++,
  exercise_id: exerciseId,
  type,
  sets,
});

const toFormSet = (reps, weight) => ({
  ...emptySet(),
  reps: reps != null ? String(reps) : "",
  weight: weight != null ? String(Number(weight)) : "",
});

// Séries da API -> exercícios, pela ordem em que cada exercício aparece
// pela primeira vez; o tipo do exercício é o da sua primeira série.
function groupSetsByExercise(apiSets) {
  const byExercise = new Map();
  for (const set of apiSets) {
    const exerciseId = String(set.exercise_id);
    if (!byExercise.has(exerciseId)) byExercise.set(exerciseId, newExercise(exerciseId, [], set.set_type || "normal"));
    byExercise.get(exerciseId).sets.push(toFormSet(set.reps, set.weight));
  }
  return byExercise.size ? [...byExercise.values()] : [newExercise()];
}

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// O tick de cada segundo vive só aqui — se estivesse no estado da página,
// re-renderizava o formulário inteiro (todas as séries e o seletor de
// exercícios, mesmo aberto) uma vez por segundo durante o treino.
function ActiveWorkoutTimer({ start }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const tick = () => setElapsedSeconds(Math.floor((Date.now() - start.getTime()) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [start]);

  return (
    <div className="log-timer">
      <span className="log-timer-dot" />
      <span className="log-timer-time">{formatElapsed(elapsedSeconds)}</span>
    </div>
  );
}

export default function LogWorkoutPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  // "Iniciar treino" num dia de um plano (PlanCard) abre /log?plan=X&day=Y:
  // o treino começa logo com os exercícios desse dia.
  const [searchParams, setSearchParams] = useSearchParams();

  const [exercises, setExercises] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [selectedDayId, setSelectedDayId] = useState("");

  const [title, setTitle] = useState("");
  // /log?date=YYYY-MM-DD (ex: "Registar treino" num dia sem treinos do
  // calendário) já abre com essa data.
  const [performedAt, setPerformedAt] = useState(() => {
    const date = searchParams.get("date");
    return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toDateKey(new Date());
  });
  const [notes, setNotes] = useState("");
  const [durationHours, setDurationHours] = useState("");
  const [durationMinutesPart, setDurationMinutesPart] = useState("");
  const [workoutExercises, setWorkoutExercises] = useState(() => [newExercise()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(isEditing);
  const navigate = useNavigate();

  const [activeStart, setActiveStart] = useState(null);

  // Recorde (maior peso) de cada exercício: exercise_id -> { weight, reps,
  // performed_at }. Ao editar um treino, esse treino fica de fora.
  const [records, setRecords] = useState(() => new Map());
  // Melhor peso já marcado como feito neste treino, por exercício — para
  // só dar os parabéns de novo se voltar a subir.
  const bestThisWorkout = useRef(new Map());
  const [achievement, setAchievement] = useState(null);
  const closeAchievement = useCallback(() => setAchievement(null), []);

  useEffect(() => {
    apiRequest("/exercises")
      .then(setExercises)
      .catch((err) => setError(err.message));
    apiRequest(`/sessions/records${isEditing ? `?exclude_session=${id}` : ""}`)
      .then((rows) => setRecords(new Map(rows.map((r) => [String(r.exercise_id), r]))))
      .catch(() => {});
    if (!isEditing) {
      apiRequest("/plans")
        .then((rows) => {
          setPlans(rows);
          const plan = rows.find((p) => String(p.id) === searchParams.get("plan"));
          const day = plan?.days.find((d) => String(d.id) === searchParams.get("day"));
          if (day) {
            setSelectedPlanId(String(plan.id));
            setSelectedDayId(String(day.id));
            startWorkout(day);
            // Tira os parâmetros do endereço para não voltar a iniciar ao
            // recarregar/voltar atrás.
            setSearchParams({}, { replace: true });
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEditing) return;
    apiRequest(`/sessions/${id}`)
      .then((session) => {
        setTitle(session.title || "");
        setPerformedAt(session.performed_at);
        setNotes(session.notes || "");
        if (session.started_at && session.ended_at) {
          const totalMinutes = Math.round((new Date(session.ended_at) - new Date(session.started_at)) / 60000);
          setDurationHours(String(Math.floor(totalMinutes / 60)));
          setDurationMinutesPart(String(totalMinutes % 60));
        }
        setWorkoutExercises(groupSetsByExercise(session.sets));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSession(false));
  }, [id, isEditing]);

  const selectedPlan = plans.find((p) => String(p.id) === selectedPlanId);
  const daysForSelectedPlan = selectedPlan ? selectedPlan.days : [];

  function handleStart() {
    startWorkout(daysForSelectedPlan.find((d) => String(d.id) === selectedDayId));
  }

  // Inicia o cronómetro; com um dia de plano, preenche o título e os
  // exercícios a partir dele.
  function startWorkout(day) {
    setActiveStart(new Date());

    if (day) {
      setTitle((current) => current || day.name);
      // Cada exercício do plano já vem com uma linha por série prevista
      // (pode variar entre séries, ex: pirâmide); as reps/carga alvo de
      // cada uma ficam como fundo do respetivo campo.
      setWorkoutExercises(
        day.exercises.length
          ? day.exercises.map((ex) =>
              newExercise(
                String(ex.exercise_id),
                (ex.sets.length ? ex.sets : [{}]).map((set) => ({
                  ...emptySet(),
                  repsHint: formatReps(set.target_reps, set.target_reps_max),
                  weightHint: set.target_load != null ? Number(set.target_load).toLocaleString("pt-PT") : "",
                })),
                ex.set_type || "normal"
              )
            )
          : [newExercise()]
      );
    }
  }

  function replaceExercise(exerciseIndex, updated) {
    setWorkoutExercises((prev) => prev.map((ex, i) => (i === exerciseIndex ? updated : ex)));
  }

  // Marca/desmarca uma série como feita. Ao marcar, se o peso for maior que
  // o recorde do exercício (e que o melhor já feito neste treino), mostra a
  // conquista. Só há "recorde batido" se já existia um recorde.
  function toggleSetDone(exerciseIndex, setIndex) {
    const ex = workoutExercises[exerciseIndex];
    const set = ex.sets[setIndex];
    const done = !set.done;
    replaceExercise(exerciseIndex, {
      ...ex,
      sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, done } : s)),
    });

    const weight = Number(set.weight) || 0;
    const record = records.get(ex.exercise_id);
    if (!done || !record || weight <= 0) return;
    const best = Math.max(record.weight, bestThisWorkout.current.get(ex.exercise_id) || 0);
    if (weight > best) {
      bestThisWorkout.current.set(ex.exercise_id, weight);
      const name = exercises.find((e) => String(e.id) === ex.exercise_id)?.name || "Exercício";
      setAchievement({
        title: "Novo recorde pessoal!",
        message: `${name}: ${weight.toLocaleString("pt-PT")} kg × ${set.reps}`,
        detail: `Anterior: ${record.weight.toLocaleString("pt-PT")} kg — parabéns, continua assim!`,
      });
    }
  }

  function addExercise() {
    setWorkoutExercises((prev) => [...prev, newExercise()]);
  }

  function removeExercise(exerciseIndex) {
    setWorkoutExercises((prev) => prev.filter((_, i) => i !== exerciseIndex));
  }

  // Séries preenchidas (exercício escolhido + reps), já na forma plana que a
  // API espera; também alimentam o resumo no cabeçalho. As séries vazias
  // (ex: o plano previa 4 e só se fizeram 3) ficam simplesmente de fora.
  const filledSets = workoutExercises
    .filter((ex) => ex.exercise_id)
    .flatMap((ex) =>
      ex.sets.filter((set) => set.reps).map((set) => ({ ...set, exercise_id: ex.exercise_id, set_type: ex.type }))
    );
  const cardioIds = new Set(exercises.filter((e) => e.muscle_group === CARDIO_GROUP).map((e) => String(e.id)));
  // Cardio (minutos × km) não entra no volume.
  const totalVolume = filledSets
    .filter((set) => !cardioIds.has(set.exercise_id))
    .reduce((sum, set) => sum + Number(set.reps) * (Number(set.weight) || 0), 0);
  const exerciseCount = workoutExercises.filter((ex) => ex.exercise_id).length;
  // Drop set, rest-pause e cluster contam como uma série (as linhas são
  // partes dela).
  const seriesCount = workoutExercises
    .filter((ex) => ex.exercise_id)
    .reduce((sum, ex) => {
      const filled = ex.sets.filter((set) => set.reps).length;
      return sum + (setTypeInfo(ex.type).singleSeries ? Math.min(filled, 1) : filled);
    }, 0);
  const exerciseNameById = new Map(exercises.map((e) => [String(e.id), e.name]));
  const doneCount = filledSets.filter((set) => set.done).length;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body = {
        title: title || null,
        performed_at: performedAt,
        notes,
        sets: filledSets.map(({ exercise_id, reps, weight, set_type }) => ({
          exercise_id: Number(exercise_id),
          reps: Number(reps),
          weight: weight ? Number(weight) : null,
          set_type,
        })),
      };

      if (activeStart) {
        body.started_at = activeStart.toISOString();
        body.ended_at = new Date().toISOString();
        if (selectedDayId) body.plan_day_id = Number(selectedDayId);
      } else {
        const totalMinutes = (Number(durationHours) || 0) * 60 + (Number(durationMinutesPart) || 0);
        if (totalMinutes > 0) {
          // Duração editada à mão (sem cronómetro): usa a data do treino às
          // 00:00 como início fictício — só a diferença entre as duas
          // importa para calcular a duração a mostrar.
          const start = new Date(`${performedAt}T00:00:00.000Z`);
          const end = new Date(start.getTime() + totalMinutes * 60000);
          body.started_at = start.toISOString();
          body.ended_at = end.toISOString();
        }
      }

      if (isEditing) {
        await apiRequest(`/sessions/${id}`, { method: "PUT", body });
      } else {
        await apiRequest("/sessions", { method: "POST", body });
      }
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loadingSession) {
    return (
      <div className="page-center">
        <p className="text-secondary">A carregar...</p>
      </div>
    );
  }

  return (
    <div className="page-container log-page">
      <div className="log-header">
        <span className="log-header-icon">
          <IconPlusCircle size={22} />
        </span>
        <h1>{isEditing ? "Editar treino" : "Registar treino"}</h1>
      </div>

      {!isEditing && (
        <GlassCard className={`log-card log-start${activeStart ? " running" : ""}`} strong>
          <span className="log-start-icon">
            <IconStopwatch size={34} />
          </span>
          <div className="log-start-text">
            <h2>{activeStart ? "Treino em curso" : "Iniciar com cronómetro"}</h2>
            {activeStart && <ActiveWorkoutTimer start={activeStart} />}
          </div>

          {!activeStart && (
            <div className="log-start-actions">
              <Select
                className="log-select"
                value={selectedPlanId}
                onChange={(planId) => {
                  setSelectedPlanId(planId);
                  setSelectedDayId("");
                }}
                options={[
                  { value: "", label: "Treino livre (sem plano)" },
                  ...plans.map((plan) => ({ value: String(plan.id), label: plan.name })),
                ]}
                ariaLabel="Plano de treino"
              />
              {selectedPlan && (
                <Select
                  className="log-select"
                  value={selectedDayId}
                  onChange={setSelectedDayId}
                  options={daysForSelectedPlan.map((day) => ({ value: String(day.id), label: day.name }))}
                  placeholder="Escolhe o dia..."
                  ariaLabel="Dia do plano"
                />
              )}
              <button type="button" className="glass-button log-start-button" onClick={handleStart}>
                <IconPlay size={18} />
                Iniciar treino
              </button>
            </div>
          )}
        </GlassCard>
      )}

      <form className="log-form" onSubmit={handleSubmit}>
        <GlassCard className="log-card">
          <div className="log-card-header">
            <IconFileText size={26} />
            <h2>Detalhes do treino</h2>
          </div>

          <div className={`log-details-grid${activeStart ? " no-duration" : ""}`}>
            <div>
              <label className="log-label" htmlFor="title">
                Título <span>(opcional)</span>
              </label>
              <input
                id="title"
                type="text"
                className="glass-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Peito e tríceps"
              />
            </div>

            <div>
              <label className="log-label" htmlFor="date">
                Data
              </label>
              <DatePicker id="date" value={performedAt} onChange={setPerformedAt} max={toDateKey(new Date())} ariaLabel="Data do treino" />
            </div>

            {!activeStart && (
              <div>
                <label className="log-label" htmlFor="duration-hours">
                  Duração <span>(opcional)</span>
                </label>
                <div className="log-duration">
                  <div className="log-suffix-input">
                    <input
                      id="duration-hours"
                      type="number"
                      min="0"
                      className="glass-input"
                      value={durationHours}
                      onChange={(e) => setDurationHours(e.target.value)}
                      placeholder="0"
                      aria-label="Horas"
                    />
                    <span>horas</span>
                  </div>
                  <div className="log-suffix-input">
                    <input
                      id="duration-minutes"
                      type="number"
                      min="0"
                      max="59"
                      className="glass-input"
                      value={durationMinutesPart}
                      onChange={(e) => setDurationMinutesPart(e.target.value)}
                      placeholder="0"
                      aria-label="Minutos"
                    />
                    <span>min</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>

        <GlassCard className="log-card">
          <div className="log-card-header">
            <IconDumbbell size={28} />
            <h2>Exercícios</h2>
            <div className="log-sets-summary">
              <span>
                <IconDumbbell size={18} />
                Exercícios: <strong>{exerciseCount}</strong>
              </span>
              <span className="log-sets-summary-divider" />
              <span>
                <IconLayers size={18} />
                Séries: <strong>{seriesCount}</strong>
                {filledSets.length > 0 && (
                  <span className="log-done-count">
                    ({doneCount}/{filledSets.length} ✓)
                  </span>
                )}
              </span>
              <span className="log-sets-summary-divider" />
              <span>
                <IconBarChart size={18} />
                Volume: <strong>{Math.round(totalVolume).toLocaleString("pt-PT")} kg</strong>
              </span>
            </div>
          </div>

          <div className="log-exercises">
            {workoutExercises.map((ex, exerciseIndex) => (
              <WorkoutExerciseBlock
                key={ex.key}
                ex={ex}
                index={exerciseIndex}
                exercises={exercises}
                record={records.get(ex.exercise_id)}
                nextExerciseName={exerciseNameById.get(workoutExercises[exerciseIndex + 1]?.exercise_id)}
                canRemove={workoutExercises.length > 1}
                onChange={(updated) => replaceExercise(exerciseIndex, updated)}
                onRemove={() => removeExercise(exerciseIndex)}
                onToggleDone={(setIndex) => toggleSetDone(exerciseIndex, setIndex)}
                onExerciseCreated={(newEx) => setExercises((prev) => [...prev, newEx])}
                onExerciseDeleted={(id) => setExercises((prev) => prev.filter((e) => e.id !== id))}
              />
            ))}

            <button type="button" className="log-add-set" onClick={addExercise}>
              <IconPlusCircle size={18} />
              Adicionar exercício
            </button>
          </div>
        </GlassCard>

        <GlassCard className="log-card">
          <div className="log-card-header">
            <IconNotes size={24} />
            <h2>
              Notas <span>(opcional)</span>
            </h2>
          </div>
          <textarea
            id="notes"
            className="glass-input log-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Como correu o treino?"
            rows={3}
          />
        </GlassCard>

        {error && <p className="error-text">{error}</p>}

        <div className="log-actions">
          <button type="button" className="glass-button glass-button-secondary" onClick={() => navigate(-1)}>
            Cancelar
          </button>
          <button type="submit" className="glass-button log-save-button" disabled={loading}>
            <IconSave size={18} />
            {loading
              ? "A guardar..."
              : activeStart
              ? "Terminar treino"
              : isEditing
              ? "Guardar alterações"
              : "Guardar treino"}
          </button>
        </div>
      </form>

      {achievement && <AchievementToast achievement={achievement} onClose={closeAchievement} />}
    </div>
  );
}
