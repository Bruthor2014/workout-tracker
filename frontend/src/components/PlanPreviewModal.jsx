import { useEffect, useState } from "react";
import Modal from "./Modal";
import GlassCard from "./GlassCard";
import PlanCard from "./PlanCard";
import NutritionPlanCard from "./NutritionPlanCard";
import { IconCheck, IconShare } from "./Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";

const PLAN_LABEL = { workout: "Plano de treino partilhado", nutrition: "Plano de nutrição partilhado" };

function FromAvatar({ person }) {
  const url = resolveAssetUrl(person.avatar_url);
  if (url) return <img src={url} alt="" className="member-card-avatar share-contact-avatar" />;
  return (
    <span className="member-card-avatar member-card-avatar-fallback share-contact-avatar">
      {person.name.charAt(0).toUpperCase()}
    </span>
  );
}

// "Ver o plano e usar se quiser", não "aceitar às ciegas" — mostra o plano
// completo, só de leitura (reaproveita PlanCard/NutritionPlanCard sem
// editable/canStart/trackCompletion, por isso nenhum botão de edição
// aparece), com "Copiar para os meus planos" como ação explícita separada
// de só ver (ver GET /plan-shares/:id/view e POST /plan-shares/:id/copy).
export default function PlanPreviewModal({ shareId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [copying, setCopying] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

  useEffect(() => {
    apiRequest(`/plan-shares/${shareId}/view`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [shareId]);

  async function handleCopy() {
    setCopying(true);
    setError("");
    try {
      await apiRequest(`/plan-shares/${shareId}/copy`, { method: "POST" });
      setJustCopied(true);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setCopying(false);
    }
  }

  const alreadyCopied = justCopied || data?.status === "copied";

  return (
    <Modal onClose={onClose} className="plan-preview-modal-wrap">
      <div className="plan-preview-modal">
        {error && (
          <GlassCard strong>
            <p className="error-text">{error}</p>
          </GlassCard>
        )}
        {!data && !error && (
          <GlassCard strong>
            <p className="text-secondary">A carregar...</p>
          </GlassCard>
        )}
        {data && (
          <GlassCard strong className="plan-preview-header">
            <FromAvatar person={data.from_user} />
            <div>
              <span className="share-plan-eyebrow">{PLAN_LABEL[data.plan_type]}</span>
              <h3>{data.from_user.name}</h3>
            </div>
          </GlassCard>
        )}
        {data && data.plan_type === "workout" && <PlanCard plan={data.plan} exercises={[]} records={new Map()} />}
        {data && data.plan_type === "nutrition" && <NutritionPlanCard plan={data.plan} />}
        {data && (
          <GlassCard strong className="plan-preview-actions">
            {alreadyCopied ? (
              <p className="text-secondary plan-preview-copied">
                <IconCheck size={15} /> Já copiaste este plano para a tua conta.
              </p>
            ) : (
              <button type="button" className="glass-button" onClick={handleCopy} disabled={copying}>
                <IconShare size={15} />
                {copying ? "A copiar..." : "Copiar para os meus planos"}
              </button>
            )}
            <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
              Fechar
            </button>
          </GlassCard>
        )}
      </div>
    </Modal>
  );
}
