import { useState } from "react";
import GlassCard from "./GlassCard";
import Modal from "./Modal";
import Select from "./Select";
import { IconSave } from "./Icons";
import { apiRequest } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";

// Cargos de equipa atribuíveis por email (espelha o TEAM_ROLES do
// backend). Inclui "reception_station" — a conta do PC fixo da receção
// — mas não via o TEAM_ROLES do frontend, que também controla acesso a
// páginas de horário/equipa que essa conta não deve ter.
const ROLE_OPTIONS = ["personal_trainer", "nutritionist", "receptionist", "intern", "reception_station"].map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

// CEO: juntar à equipa alguém que já está no ginásio, pelo email.
export default function AddToTeamModal({ onClose, onAdded }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("personal_trainer");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const person = await apiRequest("/members/team", { method: "POST", body: { email, role } });
      onAdded(person);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card schedule-form" strong>
        <h3>Adicionar à equipa</h3>
        <form onSubmit={handleSubmit}>
          <div className="schedule-form-grid">
            <label className="span-2">
              <span className="log-label">Email</span>
              <input
                className="glass-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: ana@gmail.com"
                required
                autoFocus
              />
            </label>
            <div className="span-2">
              <span className="log-label">Cargo</span>
              <Select value={role} onChange={setRole} options={ROLE_OPTIONS} ariaLabel="Cargo" />
            </div>
          </div>
          <p className="text-secondary add-person-hint">A pessoa tem de já ter conta no ginásio.</p>
          {error && <p className="error-text">{error}</p>}
          <div className="schedule-form-actions">
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="glass-button log-save-button" disabled={saving}>
              <IconSave size={18} />
              {saving ? "A adicionar..." : "Adicionar"}
            </button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}
