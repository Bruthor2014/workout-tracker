import { createContext, useCallback, useContext, useEffect, useRef } from "react";

// Permite a uma página "interceptar" o botão Voltar do MobileTopBar quando
// tem uma vista interna aberta (ex: formulário de criar um plano dentro da
// própria página, sem mudar de rota) — nesse caso Voltar deve fechar essa
// vista em vez de navegar no histórico do browser.
const BackOverrideContext = createContext(null);

export function BackOverrideProvider({ children }) {
  const overrideRef = useRef(null);

  const setBackOverride = useCallback((fn) => {
    overrideRef.current = fn;
  }, []);

  const clearBackOverride = useCallback((fn) => {
    // Só limpa se quem está a pedir ainda for quem registou por último —
    // evita que um unmount tardio apague o override de outra vista que já
    // tenha assumido o controlo entretanto.
    if (overrideRef.current === fn) {
      overrideRef.current = null;
    }
  }, []);

  const runBack = useCallback((fallback) => {
    if (overrideRef.current) {
      overrideRef.current();
    } else {
      fallback();
    }
  }, []);

  return (
    <BackOverrideContext.Provider value={{ setBackOverride, clearBackOverride, runBack }}>
      {children}
    </BackOverrideContext.Provider>
  );
}

export function useBackOverride() {
  return useContext(BackOverrideContext);
}

// Hook de conveniência para páginas: enquanto `active` for true, Voltar
// chama `onBack` em vez de navegar. Ex: useBackButtonOverride(showForm, () => setShowForm(false)).
export function useBackButtonOverride(active, onBack) {
  const { setBackOverride, clearBackOverride } = useBackOverride();

  useEffect(() => {
    if (!active) return;
    setBackOverride(onBack);
    return () => clearBackOverride(onBack);
  }, [active, onBack, setBackOverride, clearBackOverride]);
}
