import { useEffect, useRef, useState } from "react";
import GlassCard from "./GlassCard";
import Modal from "./Modal";
import { apiRequest } from "../api/client";

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Pedida logo a seguir a uma conta Google nova — a Google nem sempre
// devolve um nome (ou devolve algo que não é bem o nome da pessoa), por
// isso o nome fica sempre confirmado explicitamente em vez de aceitar o
// que vier (ou o prefixo do email) sem perguntar.
function ConfirmNameStep({ suggestedName, onDone, onError }) {
  const [name, setName] = useState(suggestedName || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const user = await apiRequest("/users/me", { method: "PUT", body: { name: name.trim() } });
      onDone(user);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={() => {}}>
      <GlassCard className="auth-card" strong>
        <h1>Como te chamas?</h1>
        <p className="text-secondary">Só mais um passo para a tua conta ficar pronta.</p>
        <form onSubmit={handleSubmit}>
          <div>
            <label className="field-label" htmlFor="google-name">Nome</label>
            <input id="google-name" type="text" className="glass-input" value={name}
              onChange={(e) => setName(e.target.value)} placeholder="O teu nome" required autoFocus />
          </div>
          <button className="glass-button" type="submit" disabled={saving || !name.trim()}>
            {saving ? "A guardar..." : "Continuar"}
          </button>
        </form>
      </GlassCard>
    </Modal>
  );
}

// Botão "Continuar com Google" via Google Identity Services (script oficial
// da Google, carregado só quando preciso — nada de SDK pesado). Sem
// VITE_GOOGLE_CLIENT_ID configurado (ver frontend/.env.example), não
// renderiza nada — é assim que o botão fica escondido até haver
// credenciais a sério, tanto aqui como no botão espelho do backend.
//
// Trata o fluxo todo sozinho (chama /api/auth/google, pede confirmação do
// nome se for conta nova) para o Registar e o Entrar não duplicarem esta
// lógica — só avisam `onAuthenticated({token, user})` quando está tudo
// pronto para entrar, e `onError(message)` se algo falhar.
export default function GoogleSignInButton({ onAuthenticated, onError }) {
  const btnRef = useRef(null);
  const [pending, setPending] = useState(null); // { token, user } de uma conta nova, à espera do nome

  async function handleCredential(credential) {
    try {
      const data = await apiRequest("/auth/google", { method: "POST", body: { credential } });
      if (data.is_new) {
        setPending(data);
      } else {
        onAuthenticated(data);
      }
    } catch (err) {
      onError(err.message);
    }
  }

  useEffect(() => {
    if (!CLIENT_ID) return;

    function render() {
      if (!window.google?.accounts?.id || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (response) => handleCredential(response.credential),
        // Sem isto, o Safari (sobretudo iOS, com a proteção "Prevent
        // Cross-Site Tracking" ligada por omissão) pode bloquear o botão
        // silenciosamente — bloqueia cookies de terceiros, que a Google
        // usa para saber se já há sessão. itp_support avisa a biblioteca
        // para usar um caminho compatível com essa proteção.
        itp_support: true,
        // Sem isto, em quem já tem sessão Google aberta no browser, o
        // botão troca sozinho para "Continuar como <Nome>" com a foto da
        // conta (o FedCM do browser mostra-a por cima do nosso texto) —
        // queríamos sempre o botão genérico "Continuar com o Google".
        use_fedcm_for_button: false,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      // A API só aceita uma largura fixa em píxeis (não "100%"), por isso
      // mede-se o espaço real do cartão para o botão ficar com a mesma
      // largura dos outros (em vez do valor fixo de antes, que não batia
      // certo com o cartão). 400 é o máximo que a Google permite.
      const width = Math.min(btnRef.current.offsetWidth || 400, 400);
      window.google.accounts.id.renderButton(btnRef.current, {
        theme: "filled_black",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "center",
        width,
      });
    }

    if (window.google?.accounts?.id) {
      render();
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", render, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = render;
    document.head.appendChild(script);
    // O script fica no documento (pode ser reaproveitado por outro sítio
    // que use este componente); não há nada para desmontar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!CLIENT_ID) return null;
  return (
    <>
      <div ref={btnRef} className="google-signin-button" />
      {pending && (
        <ConfirmNameStep
          suggestedName={pending.user.name}
          onDone={(updatedUser) => onAuthenticated({ token: pending.token, user: { ...pending.user, ...updatedUser } })}
          onError={(msg) => {
            // Mesmo que a atualização do nome falhe, a conta já existe e o
            // login é válido — não deixar a pessoa presa sem conseguir
            // entrar por causa disto. Só avisa do erro.
            onError(msg);
            onAuthenticated(pending);
          }}
        />
      )}
    </>
  );
}
