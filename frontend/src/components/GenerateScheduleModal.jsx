import { useState } from "react";
import GlassCard from "./GlassCard";
import Modal from "./Modal";
import Select from "./Select";
import { apiRequest } from "../api/client";
import { ROLE_LABELS } from "../utils/roles";
import { TIME_OPTIONS } from "../utils/schedule";

const STORAGE_KEY = "generator-options";

const FUNCTIONS = [
  { value: "floor", label: "Sala" },
  { value: "reception", label: "Receção" },
];
// Igual ao backend (scheduleGenerator.js): funções por omissão de cada cargo.
const DEFAULT_FUNCTIONS = {
  personal_trainer: ["floor", "reception"],
  nutritionist: ["reception"],
  receptionist: ["reception"],
  intern: ["reception"],
};

const PEAK_OPTIONS = TIME_OPTIONS.filter((t) => t.value >= "13:00" && t.value <= "20:00");
const FLOOR_OPTIONS = [
  { value: 1, label: "1 PT" },
  { value: 2, label: "2 PTs" },
];
const DAYS_OPTIONS = [3, 4, 5, 6, 7].map((n) => ({ value: n, label: `${n} dias` }));

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function initialOptions(staff) {
  const saved = loadSaved();
  const savedPeople = new Map((saved.people || []).map((p) => [p.id, p]));
  return {
    peak_start: saved.peak_start || "17:00",
    peak_floor: saved.peak_floor ?? 2,
    base_floor: saved.base_floor ?? 1,
    people: staff.map((s) => ({
      id: s.id,
      include: true,
      max_hours: 40,
      max_days: 6,
      functions: DEFAULT_FUNCTIONS[s.role] || [],
      ...savedPeople.get(s.id),
    })),
  };
}

// CEO: escolher as regras e, por pessoa, as horas, os dias e as funções;
// depois gera o horário e mostra o resultado (faltas e horas de cada um).
export default function GenerateScheduleModal({ staff, onClose, onDone }) {
  const [options, setOptions] = useState(() => initialOptions(staff));
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const set = (field) => (value) => setOptions((o) => ({ ...o, [field]: value }));
  const setPerson = (id, patch) =>
    setOptions((o) => ({ ...o, people: o.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const toggleFunction = (p, fn) =>
    setPerson(p.id, { functions: p.functions.includes(fn) ? p.functions.filter((f) => f !== fn) : [...p.functions, fn] });

  const byId = new Map(staff.map((s) => [s.id, s]));
  const included = options.people.filter((p) => p.include && p.functions.length && Number(p.max_hours) > 0);
  const totalHours = included.reduce((sum, p) => sum + Number(p.max_hours || 0), 0);

  async function run() {
    if (!window.confirm(
      "Isto apaga TODOS os turnos atuais da equipa e substitui pelos novos. Não pode ser desfeito. " +
      "As aulas de grupo não são tocadas — isso continua a gerir-se à mão. Continuar?"
    )) return;
    setRunning(true);
    setError("");
    try {
      const body = {
        ...options,
        people: options.people.map((p) => ({ ...p, max_hours: Number(p.max_hours) || 0 })),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(body));
      } catch {
        // sem armazenamento: as opções não ficam guardadas, mais nada
      }
      setResult(await apiRequest("/shifts/generate", { method: "POST", body }));
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Modal onClose={onClose} className="generate-modal-wrap">
      <GlassCard className="preview-card schedule-form generate-modal" strong>
        <h3>Gerar horário automático</h3>
        {!result ? (
          <>
            <p className="text-secondary generate-intro">
              Ginásio aberto das 06:00 às 23:00, em três turnos: manhã, tarde e hora de ponta. Há sempre alguém na sala e na receção, e cada pessoa faz no máximo 1 turno por dia.
            </p>

            <div className="generate-section">
              <span className="log-label">Regras gerais</span>
              <div className="generate-rules-grid">
                <div>
                  <span className="generate-field-label">Hora de ponta a partir das</span>
                  <Select value={options.peak_start} onChange={set("peak_start")} options={PEAK_OPTIONS} ariaLabel="Hora de ponta" />
                </div>
                <div>
                  <span className="generate-field-label">Sala na hora de ponta</span>
                  <Select value={options.peak_floor} onChange={(v) => set("peak_floor")(Number(v))} options={FLOOR_OPTIONS} ariaLabel="PTs na hora de ponta" />
                </div>
                <div>
                  <span className="generate-field-label">Sala no resto do dia</span>
                  <Select value={options.base_floor} onChange={(v) => set("base_floor")(Number(v))} options={FLOOR_OPTIONS} ariaLabel="PTs fora da ponta" />
                </div>
              </div>
            </div>

            <div className="generate-section">
              <span className="log-label">
                Equipa <span>· {included.length} pessoas · até {totalHours} h/semana no total</span>
              </span>
              <ul className="generate-people">
                {options.people.map((p) => {
                  const s = byId.get(p.id);
                  if (!s) return null;
                  return (
                    <li key={p.id} className={p.include ? "" : "off"}>
                      <label className="generate-person">
                        <input type="checkbox" checked={p.include} onChange={(e) => setPerson(p.id, { include: e.target.checked })} />
                        <span>
                          <strong>{s.name}</strong>
                          <span className="text-secondary">{ROLE_LABELS[s.role] || s.role}</span>
                        </span>
                      </label>
                      <div className="generate-functions" role="group" aria-label={`Funções de ${s.name}`}>
                        {FUNCTIONS.map((f) => (
                          <button
                            type="button"
                            key={f.value}
                            className={`generate-fn${p.functions.includes(f.value) ? " on" : ""}`}
                            onClick={() => toggleFunction(p, f.value)}
                            disabled={!p.include}
                            aria-pressed={p.functions.includes(f.value)}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                      <label className="generate-hours-input">
                        <input
                          className="glass-input"
                          type="number"
                          min="0"
                          max="60"
                          value={p.max_hours}
                          onChange={(e) => setPerson(p.id, { max_hours: e.target.value })}
                          disabled={!p.include}
                          aria-label={`Horas por semana de ${s.name}`}
                        />
                        <span>h/sem.</span>
                      </label>
                      <div className="generate-days">
                        <Select
                          value={p.max_days}
                          onChange={(v) => setPerson(p.id, { max_days: Number(v) })}
                          options={DAYS_OPTIONS}
                          ariaLabel={`Dias por semana de ${s.name}`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="class-detail-alert">
              Substitui todos os turnos atuais da equipa. As aulas de grupo não são tocadas — continuam a geri-se à mão em "Aulas de grupo".
            </p>
          </>
        ) : (
          <div className="generate-result">
            <p>
              ✅ {result.shifts} turnos criados.{" "}
              {result.gaps.length === 0 ? "Todas as horas estão cobertas." : "Ficou por cobrir:"}
            </p>
            {result.gaps.length > 0 && (
              <>
                <ul className="generate-gaps">
                  {result.gaps.slice(0, 10).map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                  {result.gaps.length > 10 && <li>… e mais {result.gaps.length - 10}</li>}
                </ul>
                <p className="text-secondary generate-tip">
                  Para cobrir tudo, dá mais horas ou dias a alguém, junta mais funções (ex: Receção) ou adiciona alguém à equipa.
                </p>
              </>
            )}
            {result.conflicts && result.conflicts.length > 0 && (
              <div className="class-detail-alert" style={{ background: "rgba(251,191,36,0.12)", borderColor: "rgba(251,191,36,0.4)" }}>
                <strong>⚠️ {result.conflicts.length} turno(s) gerado(s) solapam sessões com clientes:</strong>
                <ul style={{ margin: "6px 0 0 16px", fontSize: "0.82rem" }}>
                  {result.conflicts.map((c, i) => (
                    <li key={i}>{c.staff} · Dia {c.weekday} {c.shift} · {c.sessions} sessão(ões)</li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="generate-hours">
              {result.hours.map((p) => (
                <li key={p.id}>
                  <span>
                    {p.name} <span className="text-secondary">· {ROLE_LABELS[p.role]}</span>
                  </span>
                  <span>
                    {p.hours} / {p.max_hours} h · {p.days} dias
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        <div className="schedule-form-actions">
          {result && (
            <button type="button" className="glass-button glass-button-secondary" onClick={() => setResult(null)}>
              Ajustar e gerar outra vez
            </button>
          )}
          <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
            {result ? "Fechar" : "Cancelar"}
          </button>
          {!result && (
            <button type="button" className="glass-button log-save-button" onClick={run} disabled={running || included.length === 0}>
              {running ? "A gerar..." : "Gerar horário"}
            </button>
          )}
        </div>
      </GlassCard>
    </Modal>
  );
}
