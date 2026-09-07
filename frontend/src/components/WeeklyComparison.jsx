import { useEffect, useState } from "react";
import GlassCard from "./GlassCard";
import WeeklyBarChart from "./WeeklyBarChart";
import { apiRequest } from "../api/client";
import { startOfWeek, addDays, toDateKey } from "../utils/date";

const WEEKS_BACK = 4; // esta semana + 3 anteriores ("até 1 mês atrás")

function formatKg(value) {
  return `${Math.round(value)} kg`;
}

function formatMinutes(value) {
  if (value < 60) return `${Math.round(value)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return m ? `${h}h${m}` : `${h}h`;
}

function formatWeekLabel(start) {
  const end = addDays(start, 6);
  return `${start.getDate()}/${start.getMonth() + 1} a ${end.getDate()}/${end.getMonth() + 1}`;
}

// Busca as sessões das últimas WEEKS_BACK semanas (independente do filtro
// de datas do Dashboard) e agrega peso levantado e duração por semana, para
// comparar a semana atual com as anteriores.
export default function WeeklyComparison() {
  const [weeks, setWeeks] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const thisWeekStart = startOfWeek(new Date());
    const rangeStart = addDays(thisWeekStart, -7 * (WEEKS_BACK - 1));
    const rangeEnd = addDays(thisWeekStart, 6);

    apiRequest(`/sessions?from=${toDateKey(rangeStart)}&to=${toDateKey(rangeEnd)}`)
      .then((sessions) => {
        const buckets = Array.from({ length: WEEKS_BACK }, (_, i) => {
          const start = addDays(thisWeekStart, -7 * (WEEKS_BACK - 1 - i));
          return { start, weight: 0, minutes: 0 };
        });

        for (const s of sessions) {
          const performed = new Date(`${s.performed_at}T00:00:00`);
          const bucket = buckets.find((b, i) => {
            const end = i < buckets.length - 1 ? buckets[i + 1].start : addDays(b.start, 7);
            return performed >= b.start && performed < end;
          });
          if (!bucket) continue;
          bucket.weight += Number(s.total_weight_kg) || 0;
          if (s.started_at && s.ended_at) {
            bucket.minutes += (new Date(s.ended_at) - new Date(s.started_at)) / 60000;
          }
        }

        setWeeks(
          buckets.map((b) => ({
            label: formatWeekLabel(b.start),
            weight: b.weight,
            minutes: b.minutes,
          }))
        );
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!weeks) return <p className="text-secondary">A carregar...</p>;

  const hasAnyData = weeks.some((w) => w.weight > 0 || w.minutes > 0);
  if (!hasAnyData) return null;

  return (
    <div className="preview-grid" style={{ marginBottom: 20 }}>
      <GlassCard className="preview-card" strong>
        <h3>Peso levantado por semana</h3>
        <p className="text-secondary preview-caption">Esta semana vs últimas {WEEKS_BACK - 1}</p>
        <WeeklyBarChart data={weeks.map((w) => ({ label: w.label, value: w.weight }))} formatValue={formatKg} />
      </GlassCard>
      <GlassCard className="preview-card" strong>
        <h3>Tempo de treino por semana</h3>
        <p className="text-secondary preview-caption">Só treinos com cronómetro</p>
        <WeeklyBarChart data={weeks.map((w) => ({ label: w.label, value: w.minutes }))} formatValue={formatMinutes} />
      </GlassCard>
    </div>
  );
}
