// Técnicas de série que se podem escolher para cada exercício no registo de
// treino (gravadas em set_logs.set_type — ver o CHECK no schema.sql).
//   rowLabel   — nome de cada linha ("Série", "Drop", ...)
//   rowPrefix  — prefixo do número da linha (D1, RP1, B1...), ou "" para 1, 2, 3
//   singleSeries — as linhas são partes de UMA série (contam como 1 no resumo)
//   repsPlaceholder — texto de fundo das reps quando não há alvo do plano
//   color      — cor de destaque do bloco quando o tipo não é "normal"
//   hint       — explicação curta mostrada por baixo do seletor
export const SET_TYPES = [
  {
    value: "normal",
    label: "Normal",
    rowLabel: "Série",
    rowPrefix: "",
    singleSeries: false,
    repsPlaceholder: "Reps",
    color: null,
    hint: "",
  },
  {
    value: "drop",
    label: "Drop set",
    rowLabel: "Drop",
    rowPrefix: "D",
    singleSeries: true,
    repsPlaceholder: "Máx. reps",
    color: "#f97316",
    hint: "Sem descanso entre drops: baixa o peso a cada drop e faz o máximo de repetições.",
  },
  {
    value: "rest_pause",
    label: "Rest-pause",
    rowLabel: "Mini-série",
    rowPrefix: "RP",
    singleSeries: true,
    repsPlaceholder: "Máx. reps",
    color: "#ec4899",
    hint: "Mesma carga: vai até à falha, descansa 10–20 s e continua. Cada linha é uma mini-série.",
  },
  {
    value: "cluster",
    label: "Cluster",
    rowLabel: "Bloco",
    rowPrefix: "B",
    singleSeries: true,
    repsPlaceholder: "Reps",
    color: "#06b6d4",
    hint: "A série dividida em blocos curtos (ex: 3 reps) com 10–30 s de descanso entre eles.",
  },
  {
    value: "superset",
    label: "Super-set",
    rowLabel: "Série",
    rowPrefix: "",
    singleSeries: false,
    repsPlaceholder: "Reps",
    color: "#3b82f6",
    hint: "Alterna cada série com o exercício seguinte, sem descanso entre os dois.",
  },
  {
    value: "pyramid",
    label: "Pirâmide",
    rowLabel: "Série",
    rowPrefix: "",
    singleSeries: false,
    repsPlaceholder: "Reps",
    color: "#f59e0b",
    hint: "A cada série sobe a carga e desce as repetições (ou o inverso, na pirâmide invertida).",
  },
  {
    value: "failure",
    label: "Até à falha",
    rowLabel: "Série",
    rowPrefix: "",
    singleSeries: false,
    repsPlaceholder: "Máx. reps",
    color: "#f43f5e",
    hint: "Cada série vai até à falha muscular — regista quantas repetições conseguiste.",
  },
];

const BY_VALUE = new Map(SET_TYPES.map((type) => [type.value, type]));

export function setTypeInfo(value) {
  return BY_VALUE.get(value) || SET_TYPES[0];
}
