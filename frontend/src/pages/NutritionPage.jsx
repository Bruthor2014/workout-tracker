import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import NutritionPlanCard from "../components/NutritionPlanCard";
import NutritionPlanRow from "../components/NutritionPlanRow";
import NewNutritionPlanForm from "../components/NewNutritionPlanForm";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useBackButtonOverride } from "../context/BackOverrideContext";
import { IconApple } from "../components/Icons";

function NutritionMarketingView() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Planos de Nutrição</h1>
      </div>
      <p className="text-secondary" style={{ maxWidth: 560 }}>
        O nutricionista (ou o teu ginásio) monta o teu plano por refeições —
        pequeno-almoço, lanches, almoço, jantar — cada uma com uma ou mais
        opções à escolha. Também podes criar o teu próprio. Cria uma conta
        para começares.
      </p>
      <Link to="/register" className="glass-button" style={{ display: "inline-block", marginTop: 24 }}>
        Criar conta
      </Link>
    </div>
  );
}

function NutritionAuthedView() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  // Só um plano aberto de cada vez — a lista fica fechada (NutritionPlanRow)
  // até se clicar num para ver os detalhes (NutritionPlanCard).
  const [openId, setOpenId] = useState(null);
  const [dragId, setDragId] = useState(null);

  // Voltar fecha o plano aberto (ou o formulário de novo plano) em vez de
  // sair da página — sem isto, o botão Voltar do MobileTopBar navegava no
  // histórico do browser, que pode ser outra página inteiramente diferente
  // de onde se veio (ex: Planos de Treino), não "um passo atrás" dentro
  // desta página.
  useBackButtonOverride(
    showForm || openId != null,
    useCallback(() => {
      if (openId != null) setOpenId(null);
      else setShowForm(false);
    }, [openId])
  );

  // planId -> elemento DOM da linha, para medir a posição durante o
  // arrasto (ver handlePointerMove). Não precisa de causar re-render,
  // por isso é um ref, não state.
  const rowRefs = useRef(new Map());
  const dragPointerId = useRef(null);

  function loadPlans() {
    setLoading(true);
    apiRequest("/nutrition-plans")
      .then(setPlans)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPlans();
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
    apiRequest("/nutrition-plans/reorder", { method: "PUT", body: { order: plans.map((p) => p.id) } }).catch(
      (err) => {
        setError(err.message);
        loadPlans(); // a ordem local pode ter ficado dessincronizada da API
      }
    );
  }

  return (
    <div className="page-container nutrition-page">
      <div className="page-header">
        <div className="log-header">
          <span className="log-header-icon">
            <IconApple size={22} />
          </span>
          <h1>Planos de Nutrição</h1>
        </div>
        {!showForm && (
          <button className="glass-button" onClick={() => setShowForm(true)}>
            + Novo plano
          </button>
        )}
      </div>

      {showForm && (
        <NewNutritionPlanForm
          submitPath="/nutrition-plans"
          onCancel={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            loadPlans();
          }}
        />
      )}

      {loading && <p className="text-secondary">A carregar...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && plans.length === 0 && !showForm && (
        <GlassCard className="empty-state">
          <p>Ainda não tens nenhum plano de nutrição — cria o teu ou pede ao nutricionista do ginásio.</p>
        </GlassCard>
      )}

      <div className="plan-list">
        {plans.map((plan) =>
          plan.id === openId ? (
            <NutritionPlanCard
              key={plan.id}
              plan={plan}
              editable
              trackCompletion
              onChanged={loadPlans}
              onCollapse={() => setOpenId(null)}
            />
          ) : (
            <NutritionPlanRow
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

export default function NutritionPage() {
  const { user } = useAuth();
  return user ? <NutritionAuthedView /> : <NutritionMarketingView />;
}
