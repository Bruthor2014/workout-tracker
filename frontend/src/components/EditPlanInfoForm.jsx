import { useRef, useState } from "react";
import { IconCamera } from "./Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";

// Editar só nome, descrição e foto de capa de um plano de treino — pedido
// explícito para "Editar" deixar de reescrever o plano inteiro (dias
// editam-se um a um, ver PlanCard.jsx: "Editar dia"/"Criar rotina").
export default function EditPlanInfoForm({ plan, onSaved, onCancel }) {
  const [name, setName] = useState(plan.name);
  const [description, setDescription] = useState(plan.description || "");
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  const currentPhotoUrl = resolveAssetUrl(plan.photo_url);
  const shownPhoto = preview || (!removePhoto && currentPhotoUrl);

  function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  function handleRemovePhoto(e) {
    e.stopPropagation();
    setPhoto(null);
    setPreview(null);
    setRemovePhoto(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    // O Modal (quando aberto dentro de um) usa um portal para document.body
    // — o evento "submit" segue a árvore do React ao propagar, por isso sem
    // isto também disparava o onSubmit da página por trás.
    e.stopPropagation();
    if (!name.trim()) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("description", description.trim());
      if (photo) form.append("photo", photo);
      else if (removePhoto) form.append("remove_photo", "true");
      const updated = await apiRequest(`/plans/${plan.id}/info`, { method: "PATCH", body: form });
      onSaved(updated);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="exercise-create-form" onSubmit={handleSubmit}>
      <button type="button" className="exercise-create-photo" onClick={() => fileRef.current?.click()}>
        {shownPhoto ? <img src={shownPhoto} alt="" /> : <IconCamera size={26} />}
        <span>{shownPhoto ? "Trocar foto" : "Adicionar foto de capa (opcional)"}</span>
      </button>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhoto} hidden />
      {shownPhoto && (
        <button type="button" className="plan-info-remove-photo" onClick={handleRemovePhoto}>
          Remover foto
        </button>
      )}

      <label className="log-label" htmlFor="plan-info-name">
        Nome
      </label>
      <input
        id="plan-info-name"
        type="text"
        className="glass-input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
      />

      <label className="log-label" htmlFor="plan-info-description" style={{ marginTop: 12 }}>
        Descrição (opcional)
      </label>
      <textarea
        id="plan-info-description"
        className="glass-input"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />

      {error && <p className="error-text">{error}</p>}

      <div className="form-actions">
        <button type="button" className="glass-button glass-button-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="glass-button" disabled={saving || !name.trim()}>
          {saving ? "A guardar..." : "Guardar"}
        </button>
      </div>
    </form>
  );
}
