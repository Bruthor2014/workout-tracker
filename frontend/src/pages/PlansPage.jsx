import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import NewPlanForm from "../components/NewPlanForm";
import PlanCard from "../components/PlanCard";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

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
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Planos de Treino</h1>
        {!showForm && (
          <button className="glass-button" onClick={() => setShowForm(true)}>
            + Novo plano
          </button>
        )}
      </div>

      {showForm && (
        <NewPlanForm
          exercises={exercises}
          submitPath="/plans"
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
          <p>Ainda não tens nenhum plano de treino.</p>
        </GlassCard>
      )}

      <div className="session-grid">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} exercises={exercises} editable onChanged={loadPlans} />
        ))}
      </div>
    </div>
  );
}

export default function PlansPage() {
  const { user } = useAuth();
  return user ? <PlansAuthedView /> : <PlansMarketingView />;
}
