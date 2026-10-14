import { useEffect } from "react";
import { createPortal } from "react-dom";
import { IconTrophy } from "./Icons";

const VISIBLE_MS = 6000;

// Aviso de conquista (ex: novo recorde pessoal num exercício), no topo do
// ecrã. Fecha sozinho ao fim de alguns segundos ou ao clicar.
// `achievement`: { title, message, detail }.
export default function AchievementToast({ achievement, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [achievement, onClose]);

  return createPortal(
    <div className="achievement-toast" role="status" aria-live="polite" onClick={onClose}>
      <span className="achievement-toast-icon">
        <IconTrophy size={30} />
      </span>
      <span className="achievement-toast-text">
        <strong>{achievement.title}</strong>
        <span>{achievement.message}</span>
        {achievement.detail && <span className="achievement-toast-detail">{achievement.detail}</span>}
      </span>
    </div>,
    document.body
  );
}
