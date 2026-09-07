const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

// Ficheiros servidos estaticamente (ex: avatares) não estão sob /api — o
// backend serve-os a partir da raiz (app.use("/uploads", ...)). Constrói o
// URL completo a partir de um caminho relativo tipo "/uploads/avatars/x.jpg".
const SERVER_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
export function resolveAssetUrl(relativePath) {
  if (!relativePath) return null;
  if (/^https?:\/\//.test(relativePath)) return relativePath;
  return `${SERVER_ORIGIN}${relativePath}`;
}

/**
 * Wrapper simples do fetch que:
 * - prefixa sempre a base URL da API
 * - anexa automaticamente o JWT guardado (se existir) no header Authorization
 * - lança erro com a mensagem vinda do backend quando a resposta não é OK
 *
 * As rotas reais (ex: "/auth/login", "/sessions") ainda vão ser criadas no
 * backend — este ficheiro só define a forma como o frontend fala com elas.
 */
export async function apiRequest(path, { method = "GET", body, token } = {}) {
  const isFormData = body instanceof FormData;
  const headers = isFormData ? {} : { "Content-Type": "application/json" };
  const authToken = token || localStorage.getItem("token");
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    // FormData (upload de ficheiros) não passa por JSON.stringify — o
    // browser define o Content-Type com boundary automaticamente, por
    // isso não o metemos nós no header acima.
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "Erro ao comunicar com o servidor.");
  }

  return data;
}
