import { IconUsers } from "./Icons";
import { ROLE_LABELS, ROLE_COLORS } from "../utils/roles";

// Quem criou um plano (treino ou nutrição): "Plano pessoal" quando foi o
// próprio membro, ou o nome e cargo do PT/nutricionista que o fez.
export default function PlanCreator({ plan }) {
  if (plan.is_personal) {
    return <span className="plan-creator personal">Plano pessoal</span>;
  }
  const color = ROLE_COLORS[plan.created_by_role] || ROLE_COLORS.member;
  return (
    <span className="plan-creator" style={{ "--role-color": color }}>
      <IconUsers size={14} />
      {plan.created_by_name ? (
        <>
          Criado por <strong>{plan.created_by_name}</strong>
        </>
      ) : (
        "Criado por alguém que já saiu do ginásio"
      )}
      {plan.created_by_role && <span className="plan-creator-role">· {ROLE_LABELS[plan.created_by_role] || plan.created_by_role}</span>}
    </span>
  );
}
