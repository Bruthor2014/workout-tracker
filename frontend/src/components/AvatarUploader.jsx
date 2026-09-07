import { useRef, useState } from "react";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";

// Círculo de avatar clicável: mostra a foto se existir (user.avatar_url),
// senão a inicial do nome. Clicar abre o seletor de ficheiros e envia
// logo a imagem escolhida.
export default function AvatarUploader({ size = 56 }) {
  const { user, updateUser } = useAuth();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);

      // Espera POST /api/users/me/avatar (multipart/form-data, campo
      // "avatar"), a devolver { avatar_url } — ainda por construir no
      // backend. O middleware de upload (backend/middleware/upload.js) já
      // trata do multer; falta o controller que atualiza a BD.
      const data = await apiRequest("/users/me/avatar", { method: "POST", body: formData });
      updateUser({ avatar_url: data.avatar_url });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const avatarUrl = resolveAssetUrl(user.avatar_url);

  return (
    <div>
      <button
        type="button"
        className="profile-avatar"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        onClick={() => inputRef.current?.click()}
        title="Trocar foto de perfil"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="profile-avatar-img" />
        ) : (
          user.name.charAt(0).toUpperCase()
        )}
        <span className="profile-avatar-overlay">{uploading ? "..." : "Trocar"}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        hidden
      />
      {error && <p className="error-text" style={{ marginTop: 6 }}>{error}</p>}
    </div>
  );
}
