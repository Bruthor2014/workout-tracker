// Utilitários dos horários semanais (aulas de grupo e turnos da equipa).
// weekday: 1 = segunda ... 7 = domingo (igual à BD).

export const WEEKDAYS = [
  { value: 1, short: "Seg", long: "Segunda" },
  { value: 2, short: "Ter", long: "Terça" },
  { value: 3, short: "Qua", long: "Quarta" },
  { value: 4, short: "Qui", long: "Quinta" },
  { value: 5, short: "Sex", long: "Sexta" },
  { value: 6, short: "Sáb", long: "Sábado" },
  { value: 7, short: "Dom", long: "Domingo" },
];

export const weekdayName = (value) => WEEKDAYS.find((d) => d.value === Number(value))?.long || "";

// Opções de hora de 30 em 30 minutos (06:00 ... 23:30) para os Select.
export const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const minutes = 6 * 60 + i * 30;
  const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  return { value, label: value };
});

export const toMinutes = (time) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
};

export const durationHours = (start, end) => (toMinutes(end) - toMinutes(start)) / 60;

// Dia da semana de hoje no formato da BD (1 = segunda).
export const todayWeekday = () => ((new Date().getDay() + 6) % 7) + 1;

// Tipos de aula de grupo.
export const CLASS_KINDS = [
  { value: "class", label: "Aula de grupo", color: "#8b5cf6", description: "Ex: cycling, pilates, body pump, HIIT." },
  { value: "talk", label: "Palestra", color: "#0d9488", description: "Ex: palestra de nutrição, workshop." },
  { value: "event", label: "Evento", color: "#f59e0b", description: "Ex: desafio, open day, avaliação de grupo." },
];

export const classKind = (value) => CLASS_KINDS.find((k) => k.value === value) || CLASS_KINDS[0];

// Atividades dos turnos da equipa.
export const SHIFT_ACTIVITIES = [
  { value: "floor", label: "Sala", color: "#3b82f6", description: "Acompanhar os membros na sala." },
  { value: "class", label: "Aulas / estúdio", color: "#8b5cf6", description: "Bloco reservado para aulas ou estúdio." },
  { value: "reception", label: "Receção", color: "#ec4899", description: "Atendimento e inscrições." },
  { value: "assessments", label: "Avaliações", color: "#10b981", description: "Avaliações físicas e de composição corporal." },
  { value: "admin", label: "Administrativo", color: "#f59e0b", description: "Planos, relatórios, reuniões." },
  { value: "other", label: "Outro", color: "#94a3b8", description: "" },
];

export const shiftActivity = (value) => SHIFT_ACTIVITIES.find((a) => a.value === value) || SHIFT_ACTIVITIES[5];

// Sessões dos PTs com clientes (e consultas dos nutricionistas): horas fixas
// que nenhum turno ou aula pode ocupar.
export const SESSION_COLOR = "#06b6d4";
export const sessionLabel = (role) => (role === "nutritionist" ? "Consulta" : "Sessão de PT");
