import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import GlassCard from "../components/GlassCard";
import { IconRun, IconDumbbell, IconBuilding } from "../components/Icons";

const PURPOSES = [
  { id: "individual", Icon: IconRun, label: "Individual", available: true },
  { id: "personal_trainer", Icon: IconDumbbell, label: "Personal Trainer", available: false },
  { id: "gym", Icon: IconBuilding, label: "Ginásio", available: false },
];

// Primeiro passo do registo: escolher para que vais usar a app. Só
// "Individual" está ligado a um percurso real por agora — os outros
// mostram-se para dar a escolher, mas ainda não avançam.
export default function PurposePage() {
  const [purpose, setPurpose] = useState(null);
  const navigate = useNavigate();

  function handleSelect(id, available) {
    setPurpose(id);
    if (available) {
      navigate("/register");
    }
  }

  return (
    <div className="page-center">
      <GlassCard className="auth-card">
        <h1>Como vais usar a Workout Tracker?</h1>

        <div className="purpose-picker">
          {PURPOSES.map(({ id, Icon, label, available }) => (
            <button
              key={id}
              type="button"
              className={`purpose-option${purpose === id ? " selected" : ""}${!available ? " unavailable" : ""}`}
              onClick={() => handleSelect(id, available)}
            >
              <Icon size={22} />
              <span>{label}</span>
              {!available && <span className="purpose-soon">Em breve</span>}
            </button>
          ))}
        </div>

        {purpose && purpose !== "individual" && (
          <p className="text-secondary" style={{ marginTop: 18 }}>
            Este percurso ainda não está disponível — escolhe "Individual" para continuares já.
          </p>
        )}

        <p className="auth-switch">
          Já tens conta? <Link to="/login">Entrar</Link>
        </p>
      </GlassCard>
    </div>
  );
}
