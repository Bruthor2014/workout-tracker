// Figuras por grupo muscular (peito, costas, pernas...) — usadas nas linhas
// de treino, no calendário semanal e no seletor de exercícios. São PNGs
// brancos com fundo transparente em public/icons/muscles/, usados como
// máscara CSS: a cor vem de currentColor (cor do tipo de treino) e o brilho
// de um drop-shadow, por isso cada figura pode ter qualquer cor.

function MuscleIcon({ name, size = 24, className = "" }) {
  return (
    <span
      className={`muscle-icon ${className}`}
      style={{ "--muscle-icon": `url(/icons/muscles/${name}.png)`, width: size, height: size }}
      aria-hidden="true"
    />
  );
}

export function IconMuscleChest(props) {
  return <MuscleIcon name="chest" {...props} />;
}

export function IconMuscleBack(props) {
  return <MuscleIcon name="back" {...props} />;
}

export function IconMuscleLegs(props) {
  return <MuscleIcon name="legs" {...props} />;
}

export function IconMuscleGlutes(props) {
  return <MuscleIcon name="glutes" {...props} />;
}

export function IconMuscleShoulders(props) {
  return <MuscleIcon name="shoulders" {...props} />;
}

export function IconMuscleArm(props) {
  return <MuscleIcon name="arms" {...props} />;
}

export function IconMuscleCore(props) {
  return <MuscleIcon name="core" {...props} />;
}

export function IconFullBody(props) {
  return <MuscleIcon name="full-body" {...props} />;
}
