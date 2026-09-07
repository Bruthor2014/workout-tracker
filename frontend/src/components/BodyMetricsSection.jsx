import { useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import EvolutionChart from "./EvolutionChart";
import Modal from "./Modal";
import { apiRequest } from "../api/client";

const METRIC_FIELDS = [
  { field: "weight_kg", title: "Peso", unit: "kg" },
  { field: "body_fat_pct", title: "Massa gorda", unit: "%" },
  { field: "lean_mass_kg", title: "Massa magra", unit: "kg" },
  { field: "muscle_mass_kg", title: "Massa muscular", unit: "kg" },
  { field: "bone_mass_kg", title: "Massa óssea", unit: "kg" },
  { field: "body_water_pct", title: "Água corporal", unit: "%" },
];

const FORM_FIELDS = [
  { field: "weight_kg", label: "Peso (kg)", required: true },
  { field: "body_fat_pct", label: "Massa gorda (%)" },
  { field: "lean_mass_kg", label: "Massa magra (kg)" },
  { field: "muscle_mass_kg", label: "Massa muscular (kg)" },
  { field: "bone_mass_kg", label: "Massa óssea (kg)" },
  { field: "body_water_pct", label: "Água corporal (%)" },
];

const emptyMetricForm = () => ({
  recorded_at: new Date().toISOString().slice(0, 10),
  weight_kg: "",
  body_fat_pct: "",
  lean_mass_kg: "",
  muscle_mass_kg: "",
  bone_mass_kg: "",
  body_water_pct: "",
});

function metricToForm(metric) {
  return {
    recorded_at: metric.recorded_at,
    weight_kg: metric.weight_kg != null ? String(Number(metric.weight_kg)) : "",
    body_fat_pct: metric.body_fat_pct != null ? String(Number(metric.body_fat_pct)) : "",
    lean_mass_kg: metric.lean_mass_kg != null ? String(Number(metric.lean_mass_kg)) : "",
    muscle_mass_kg: metric.muscle_mass_kg != null ? String(Number(metric.muscle_mass_kg)) : "",
    bone_mass_kg: metric.bone_mass_kg != null ? String(Number(metric.bone_mass_kg)) : "",
    body_water_pct: metric.body_water_pct != null ? String(Number(metric.body_water_pct)) : "",
  };
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("pt-PT");
}

// Secção de composição corporal (botão + modal de registo, histórico
// editável/eliminável, e um gráfico por métrica). Sem memberId, usa os
// endpoints self-service (/body-metrics); com memberId, usa os endpoints
// staff (/body-metrics/member/:id — um PT/admin/nutricionista a registar
// por um membro). Editar/eliminar usam sempre /body-metrics/:id, que
// aceita tanto o dono do registo como staff.
export default function BodyMetricsSection({ memberId, title = "Composição corporal", autoOpen = false }) {
  const basePath = memberId ? `/body-metrics/member/${memberId}` : "/body-metrics";

  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyMetricForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  function loadMetrics() {
    setLoading(true);
    apiRequest(basePath)
      .then(setMetrics)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  useEffect(() => {
    if (autoOpen) openCreateForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen]);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyMetricForm());
    setFormError("");
    setShowForm(true);
  }

  function openEditForm(metric) {
    setEditingId(metric.id);
    setForm(metricToForm(metric));
    setFormError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const body = {
        recorded_at: form.recorded_at,
        weight_kg: Number(form.weight_kg),
        body_fat_pct: form.body_fat_pct ? Number(form.body_fat_pct) : null,
        lean_mass_kg: form.lean_mass_kg ? Number(form.lean_mass_kg) : null,
        muscle_mass_kg: form.muscle_mass_kg ? Number(form.muscle_mass_kg) : null,
        bone_mass_kg: form.bone_mass_kg ? Number(form.bone_mass_kg) : null,
        body_water_pct: form.body_water_pct ? Number(form.body_water_pct) : null,
      };

      if (editingId) {
        await apiRequest(`/body-metrics/${editingId}`, { method: "PUT", body });
      } else {
        await apiRequest(basePath, { method: "POST", body });
      }
      setShowForm(false);
      loadMetrics();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Eliminar este registo?")) return;
    try {
      await apiRequest(`/body-metrics/${id}`, { method: "DELETE" });
      setMetrics((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  const charts = METRIC_FIELDS.map(({ field, title: metricTitle, unit }) => ({
    title: metricTitle,
    unit,
    data: metrics
      .filter((m) => m[field] != null)
      .map((m) => ({ date: m.recorded_at, value: Number(m[field]) })),
  }));

  return (
    <>
      <div className="page-header" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button type="button" className="glass-button" onClick={openCreateForm}>
          + Registar peso
        </button>
      </div>

      {loading && <p className="text-secondary">A carregar...</p>}
      {error && <p className="error-text">{error}</p>}

      {!loading && !error && (
        <div className="preview-grid">
          {charts.map((chart) => (
            <GlassCard className="preview-card" strong key={chart.title}>
              <h3>{chart.title}</h3>
              <p className="text-secondary preview-caption">Evolução ao longo do tempo</p>
              {chart.data.length > 0 ? (
                <EvolutionChart data={chart.data} unit={chart.unit} />
              ) : (
                <p className="text-secondary" style={{ margin: 0 }}>Ainda sem registos.</p>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {!loading && !error && metrics.length > 0 && (
        <div className="metric-history">
          <h3 style={{ marginBottom: 10 }}>Histórico de registos</h3>
          <div className="table-scroll">
            <table className="metric-history-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Peso</th>
                  <th>Gorda</th>
                  <th>Magra</th>
                  <th>Muscular</th>
                  <th>Óssea</th>
                  <th>Água</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...metrics].reverse().map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.recorded_at)}</td>
                    <td>{m.weight_kg != null ? `${Number(m.weight_kg)} kg` : "-"}</td>
                    <td>{m.body_fat_pct != null ? `${Number(m.body_fat_pct)}%` : "-"}</td>
                    <td>{m.lean_mass_kg != null ? `${Number(m.lean_mass_kg)} kg` : "-"}</td>
                    <td>{m.muscle_mass_kg != null ? `${Number(m.muscle_mass_kg)} kg` : "-"}</td>
                    <td>{m.bone_mass_kg != null ? `${Number(m.bone_mass_kg)} kg` : "-"}</td>
                    <td>{m.body_water_pct != null ? `${Number(m.body_water_pct)}%` : "-"}</td>
                    <td className="metric-history-actions">
                      <button type="button" className="glass-button glass-button-secondary" onClick={() => openEditForm(m)}>
                        Editar
                      </button>
                      <button type="button" className="glass-button glass-button-secondary" onClick={() => handleDelete(m.id)}>
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <Modal onClose={() => setShowForm(false)}>
          <GlassCard className="preview-card" strong>
            <h3>{editingId ? "Editar registo" : "Registar avaliação"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="metric-form-grid">
                <div className="metric-form-field">
                  <label className="field-label" htmlFor="recorded_at">
                    Data
                  </label>
                  <input
                    id="recorded_at"
                    type="date"
                    className="glass-input"
                    value={form.recorded_at}
                    onChange={(e) => setForm((f) => ({ ...f, recorded_at: e.target.value }))}
                    required
                  />
                </div>
                {FORM_FIELDS.map(({ field, label, required }) => (
                  <div className="metric-form-field" key={field}>
                    <label className="field-label" htmlFor={field}>
                      {label}
                    </label>
                    <input
                      id={field}
                      type="number"
                      min="0"
                      step="0.1"
                      className="glass-input"
                      value={form[field]}
                      onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      required={required}
                    />
                  </div>
                ))}
              </div>

              {formError && <p className="error-text">{formError}</p>}
              <div className="form-actions">
                <button type="button" className="glass-button glass-button-secondary" onClick={() => setShowForm(false)}>
                  Cancelar
                </button>
                <button type="submit" className="glass-button" disabled={saving}>
                  {saving ? "A guardar..." : "Registar"}
                </button>
              </div>
            </form>
          </GlassCard>
        </Modal>
      )}
    </>
  );
}
