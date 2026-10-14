import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import GlassCard from "./GlassCard";
import { IconSearch, IconUtensils } from "./Icons";
import { apiRequest } from "../api/client";

const MIN_QUERY_LENGTH = 3;
// A pesquisa do Open Food Facts tem limite de pedidos: só pesquisa quando se
// pára de escrever, não a cada tecla.
const DEBOUNCE_MS = 600;

function formatMacro(value, unit = "g") {
  return value == null ? "—" : `${value.toLocaleString("pt-PT")} ${unit}`;
}

// Pesquisa de produtos (Open Food Facts, via /api/foods/search) para um
// elemento de um plano de nutrição. `onSelect(product)` recebe o produto
// escolhido (nome, marca, foto, valores por 100 g).
export default function FoodSearchModal({ initialQuery = "", onSelect, onClose }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < MIN_QUERY_LENGTH) return undefined;

    const timer = setTimeout(() => {
      // Só a resposta do pedido mais recente é mostrada (as anteriores
      // podem chegar depois, fora de ordem).
      const requestId = ++latestRequest.current;
      setLoading(true);
      setError("");
      apiRequest(`/foods/search?q=${encodeURIComponent(term)}`)
        .then((rows) => {
          if (requestId === latestRequest.current) setResults(rows);
        })
        .catch((err) => {
          if (requestId === latestRequest.current) setError(err.message);
        })
        .finally(() => {
          if (requestId === latestRequest.current) setLoading(false);
        });
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  const tooShort = query.trim().length < MIN_QUERY_LENGTH;

  return (
    <Modal onClose={onClose} className="food-search-modal-wrap">
      <GlassCard className="food-search-modal" strong>
        <div className="food-search-header">
          <h3>Pesquisar produto</h3>
          <span className="text-secondary">Continente, Pingo Doce, Lidl e outros supermercados</span>
        </div>

        <div className="food-search-input">
          <IconSearch size={18} />
          <input
            type="text"
            className="glass-input"
            placeholder="Ex: iogurte grego continente, aveia, atum..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="food-search-results">
          {tooShort && <p className="food-search-hint">Escreve pelo menos {MIN_QUERY_LENGTH} letras para pesquisar.</p>}
          {!tooShort && loading && (
            <p className="food-search-hint">
              A pesquisar...
              <br />
              <span className="food-search-hint-small">A primeira pesquisa de um termo pode demorar alguns segundos.</span>
            </p>
          )}
          {!tooShort && !loading && error && <p className="error-text food-search-hint">{error}</p>}
          {!tooShort && !loading && !error && results && results.length === 0 && (
            <p className="food-search-hint">Nenhum produto encontrado. Experimenta outras palavras ou a marca.</p>
          )}

          {!tooShort &&
            !loading &&
            !error &&
            results?.map((product) => (
              <button
                type="button"
                key={product.code}
                className="food-result"
                onClick={() => onSelect(product)}
              >
                <span className="food-result-image">
                  {product.image_url ? (
                    <img src={product.image_url} alt="" loading="lazy" />
                  ) : (
                    <IconUtensils size={22} />
                  )}
                </span>
                <span className="food-result-info">
                  <span className="food-result-name">{product.name}</span>
                  <span className="food-result-meta">
                    {[product.brand, product.package_quantity].filter(Boolean).join(" · ")}
                    {product.stores.map((store) => (
                      <span key={store} className="food-result-store">
                        {store}
                      </span>
                    ))}
                  </span>
                </span>
                <span className="food-result-nutrition">
                  <strong>{product.kcal_100g != null ? `${product.kcal_100g} kcal` : "— kcal"}</strong>
                  <span>
                    P {formatMacro(product.protein_100g)} · H {formatMacro(product.carbs_100g)} · G{" "}
                    {formatMacro(product.fat_100g)}
                  </span>
                  <span className="food-result-per">por 100 g</span>
                </span>
              </button>
            ))}
        </div>

        <div className="food-search-footer">
          <span className="text-secondary">
            Dados e imagens:{" "}
            <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer">
              Open Food Facts
            </a>
          </span>
          <button type="button" className="glass-button glass-button-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </GlassCard>
    </Modal>
  );
}
