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

// Tipos de aula de grupo. Cores seguem a rampa de destaque do tema do
// ginásio (var(--accent-*)) em vez de cores fixas, para o calendário
// acompanhar as cores escolhidas pelo CEO.
export const CLASS_KINDS = [
  { value: "class", label: "Aula de grupo", color: "var(--accent-strong)", description: "Ex: cycling, pilates, body pump, HIIT." },
  { value: "talk", label: "Palestra", color: "var(--accent-deep)", description: "Ex: palestra de nutrição, workshop." },
  { value: "event", label: "Evento", color: "var(--accent-light)", description: "Ex: desafio, open day, avaliação de grupo." },
];

export const classKind = (value) => CLASS_KINDS.find((k) => k.value === value) || CLASS_KINDS[0];

// Atividades dos turnos da equipa — mesma rampa do tema; "Outro" fica
// neutro de propósito, como âncora visual entre os tons da cor principal.
export const SHIFT_ACTIVITIES = [
  { value: "floor", label: "Sala", color: "var(--accent)", description: "Acompanhar os membros na sala." },
  { value: "class", label: "Aulas / estúdio", color: "var(--accent-strong)", description: "Bloco reservado para aulas ou estúdio." },
  { value: "reception", label: "Receção", color: "var(--accent-deep)", description: "Atendimento e inscrições." },
  { value: "assessments", label: "Avaliações", color: "var(--accent-light)", description: "Avaliações físicas e de composição corporal." },
  { value: "admin", label: "Administrativo", color: "rgba(var(--accent-strong-rgb), 0.55)", description: "Planos, relatórios, reuniões." },
  { value: "other", label: "Outro", color: "#94a3b8", description: "" },
];

export const shiftActivity = (value) => SHIFT_ACTIVITIES.find((a) => a.value === value) || SHIFT_ACTIVITIES[5];

// Sessões dos PTs com clientes (e consultas dos nutricionistas): horas fixas
// que nenhum turno ou aula pode ocupar.
export const SESSION_COLOR = "var(--accent)";
export const sessionLabel = (role) => (role === "nutritionist" ? "Consulta" : "Sessão de PT");
