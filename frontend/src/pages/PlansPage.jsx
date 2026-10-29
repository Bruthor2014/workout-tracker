import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import NewPlanForm from "../components/NewPlanForm";
import PlanCard from "../components/PlanCard";
import PlanRow from "../components/PlanRow";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useBackButtonOverride } from "../context/BackOverrideContext";
import { IconCalendar } from "../components/Icons";

const PLAN_EXAMPLE = [
  { name: "Supino Plano", sets: 4, reps: 8, load: "70 kg" },
  { name: "Agachamento", sets: 4, reps: 10, load: "90 kg" },
  { name: "Remada Curvada", sets: 3, reps: 12, load: "55 kg" },
];

function PlansMarketingView() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Planos de Treino</h1>
      </div>
      <p className="text-secondary" style={{ maxWidth: 560 }}>
        Aqui vais poder ver os planos de treino atribuídos pelo teu personal
        trainer (ou criar os teus próprios), com exercícios, séries, reps e
        carga alvo. Cria uma conta para começares.
      </p>

      <GlassCard className="preview-card" strong style={{ maxWidth: 460, marginTop: 24 }}>
        <h3>Exemplo</h3>
        <p className="text-secondary preview-caption">Segunda — Peito e Tríceps</p>
        <div className="plan-preview">
          <div className="plan-row plan-row-header">
            <span>Exercício</span>
            <span>Séries</span>
            <span>Reps</span>
            <span>Carga</span>
          </div>
          {PLAN_EXAMPLE.map((ex) => (
            <div className="plan-row" key={ex.name}>
              <span>{ex.name}</span>
              <span>{ex.sets}</span>
              <span>{ex.reps}</span>
              <span>{ex.load}</span>
            </div>
          ))}
        </div>
      </GlassCard>

      <Link to="/register" className="glass-button" style={{ display: "inline-block", marginTop: 24 }}>
        Criar conta
      </Link>
    </div>
  );
}

function PlansAuthedView() {
  const [plans, setPlans] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [records, setRecords] = useState(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  // Só um plano aberto de cada vez — a lista fica fechada (PlanRow) até se
  // clicar num para ver os detalhes (PlanCard), mesmo padrão de
  // NutritionPage.jsx.
  const [openId, setOpenId] = useState(null);
  const [dragId, setDragId] = useState(null);

  // Voltar fecha o plano aberto (ou o formulário de novo plano) em vez de
  // sair da página.
  useBackButtonOverride(
    showForm || openId != null,
    useCallback(() => {
      if (openId != null) setOpenId(null);
      else setShowForm(false);
    }, [openId])
  );

  // planId -> elemento DOM da linha, para medir a posição durante o
  // arrasto (ver handlePointerMove). Não precisa de causar re-render, por
  // isso é um ref, não state.
  const rowRefs = useRef(new Map());
  const dragPointerId = useRef(null);

  function loadPlans() {
    setLoading(true);
    apiRequest("/plans")
      .then(setPlans)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPlans();
    apiRequest("/exercises").then(setExercises).catch(() => {});
    // Recorde (maior peso) de cada exercício, para mostrar junto de cada
    // exercício do plano — mesmo endpoint usado ao registar um treino.
    apiRequest("/sessions/records")
      .then((rows) => setRecords(new Map(rows.map((r) => [String(r.exercise_id), r]))))
      .catch(() => {});
  }, []);

  function setRowRef(planId) {
    return (el) => {
      if (el) rowRefs.current.set(planId, el);
      else rowRefs.current.delete(planId);
    };
  }

  // Índice da linha cujo centro está mais perto de `y` — para onde a
  // linha arrastada "salta" quando passa a meio de outra.
  function closestIndexAtY(y) {
    let closest = null;
    let closestDist = Infinity;
    plans.forEach((plan, i) => {
      const el = rowRefs.current.get(plan.id);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const dist = Math.abs(y - mid);
      if (dist < closestDist) {
        closestDist = dist;
        closest = i;
      }
    });
    return closest;
  }

  function handlePointerDown(e, planId) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragPointerId.current = e.pointerId;
    setDragId(planId);
  }

  function handlePointerMove(e) {
    if (dragPointerId.current !== e.pointerId || dragId == null) return;
    const currentIndex = plans.findIndex((p) => p.id === dragId);
    const targetIndex = closestIndexAtY(e.clientY);
    if (currentIndex === -1 || targetIndex === null || targetIndex === currentIndex) return;
    setPlans((prev) => {
      const next = [...prev];
      const [item] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  function handlePointerUp(e) {
    if (dragPointerId.current !== e.pointerId) return;
    dragPointerId.current = null;
    setDragId(null);
    if (plans.length < 2) return;
    apiRequest("/plans/reorder", { method: "PUT", body: { order: plans.map((p) => p.id) } }).catch((err) => {
      setError(err.message);
      loadPlans(); // a ordem local pode ter ficado dessincronizada da API
    });
  }

  return (
    <div className="page-container plans-page">
      <div className="page-header">
        <div className="log-header">
          <span className="log-header-icon">
            <IconCalendar size={22} />
          </span>
          <h1>Planos de Treino</h1>
        </div>
        {!showForm && (
          <button className="glass-button" onClick={() => setShowForm(true)}>
            + Novo plano
          </button>
        )}
      </div>

      {showForm && (
        <NewPlanForm
          exercises={exercises}
          records={records}
          submitPath="/plans"
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            loadPlans();
          }}
          onExerciseCreated={(newEx) => setExercises((prev) => [...prev, newEx])}
          onExerciseDeleted={(id) => setExercises((prev) => prev.filter((e) => e.id !== id))}
        />
      )}

      {loading && <p className="text-secondary">A carregar...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && plans.length === 0 && !showForm && (
        <GlassCard className="empty-state">
          <p>Ainda não tens nenhum plano de treino.</p>
        </GlassCard>
      )}

      <div className="plan-list">
        {plans.map((plan) =>
          plan.id === openId ? (
            <PlanCard
              key={plan.id}
              plan={plan}
              exercises={exercises}
              records={records}
              editable
              canStart
              onChanged={loadPlans}
              onCollapse={() => setOpenId(null)}
              onExerciseCreated={(newEx) => setExercises((prev) => [...prev, newEx])}
              onExerciseDeleted={(id) => setExercises((prev) => prev.filter((e) => e.id !== id))}
            />
          ) : (
            <PlanRow
              key={plan.id}
              ref={setRowRef(plan.id)}
              plan={plan}
              onOpen={() => setOpenId(plan.id)}
              dragging={dragId === plan.id}
              handleProps={{
                onPointerDown: (e) => handlePointerDown(e, plan.id),
                onPointerMove: handlePointerMove,
                onPointerUp: handlePointerUp,
                onPointerCancel: handlePointerUp,
              }}
            />
          )
        )}
      </div>
    </div>
  );
}

export default function PlansPage() {
  const { user } = useAuth();
  return user ? <PlansAuthedView /> : <PlansMarketingView />;
}
