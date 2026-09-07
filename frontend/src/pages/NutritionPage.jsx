import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import NutritionPlanCard from "../components/NutritionPlanCard";
import NewNutritionPlanForm from "../components/NewNutritionPlanForm";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";

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

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Planos de Nutrição</h1>
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

      <div className="session-grid">
        {plans.map((plan) => (
          <NutritionPlanCard key={plan.id} plan={plan} editable onChanged={loadPlans} />
        ))}
      </div>
    </div>
  );
}

export default function NutritionPage() {
  const { user } = useAuth();
  return user ? <NutritionAuthedView /> : <NutritionMarketingView />;
}
