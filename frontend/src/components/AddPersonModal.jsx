import { useState } from "react";
import GlassCard from "./GlassCard";
import Modal from "./Modal";
import Select from "./Select";
import { IconSave } from "./Icons";
import { apiRequest } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";

// Cargos que o CEO pode dar (espelha ASSIGNABLE_ROLES do backend).
const ROLE_OPTIONS = ["member", "personal_trainer", "nutritionist", "receptionist", "intern"].map((value) => ({
  value,
  label: ROLE_LABELS[value],
}));

// CEO: adicionar alguém ao ginásio (membro ou equipa) com uma password
// inicial. A sugestão de password segue a regra do ginásio: nome + 123.
export default function AddPersonModal({ defaultRole = "member", onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: defaultRole });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  // Primeiro nome em minúsculas e sem acentos (ex: "Inês Costa" -> "ines").
  const slug = form.name
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const person = await apiRequest("/members", {
        method: "POST",
        body: { ...form, email: form.email || `${slug}@gmail.com`, password: form.password || `${slug}123` },
      });
      onCreated(person);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <GlassCard className="preview-card schedule-form" strong>
        <h3>Adicionar pessoa</h3>
        <form onSubmit={handleSubmit}>
          <div className="schedule-form-grid">
            <label className="span-2">
              <span className="log-label">Nome</span>
              <input className="glass-input" value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Ex: Inês Costa" required autoFocus />
            </label>
            <div className="span-2">
              <span className="log-label">Cargo</span>
              <Select value={form.role} onChange={set("role")} options={ROLE_OPTIONS} ariaLabel="Cargo" />
            </div>
            <label>
              <span className="log-label">Email</span>
              <input
                className="glass-input"
                type="email"
                value={form.email}
                onChange={(e) => set("email")(e.target.value)}
                placeholder={slug ? `${slug}@gmail.com` : "nome@gmail.com"}
              />
            </label>
            <label>
              <span className="log-label">Password inicial</span>
              <input
                className="glass-input"
                value={form.password}
                onChange={(e) => set("password")(e.target.value)}
                placeholder={slug ? `${slug}123` : "nome123"}
              />
            </label>
          </div>
          <p className="text-secondary add-person-hint">Se deixares o email ou a password em branco, usa-se o que aparece em sugestão.</p>
          {error && <p className="error-text">{error}</p>}
          <div className="schedule-form-actions">
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="glass-button log-save-button" disabled={saving || !slug}>
              <IconSave size={18} />
              {saving ? "A adicionar..." : "Adicionar"}
            </button>
          </div>
        </form>
      </GlassCard>
    </Modal>
  );
}
