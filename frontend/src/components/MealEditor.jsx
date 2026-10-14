import { useRef, useState } from "react";
import FoodSearchModal from "./FoodSearchModal";
import { IconCamera, IconPencil, IconPlusCircle, IconSearch, IconTrash } from "./Icons";
import { apiRequest, resolveAssetUrl } from "../api/client";
import { mealVisual } from "../utils/meals";
import { emptyItem, emptyOption } from "../utils/mealForm";

// Miniatura de um elemento: mostra a foto (do produto ou carregada) e, ao
// clicar, deixa carregar uma foto própria (ex: para algo que não existe no
// Open Food Facts).
function FoodPhotoButton({ imageUrl, onUploaded, onError }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const { image_url } = await apiRequest("/foods/photo", { method: "POST", body: formData });
      onUploaded(image_url);
    } catch (err) {
      onError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`food-photo-button${imageUrl ? " has-image" : ""}`}
        onClick={() => inputRef.current.click()}
        title={imageUrl ? "Trocar foto" : "Adicionar foto"}
        aria-label={imageUrl ? "Trocar foto" : "Adicionar foto"}
        disabled={uploading}
      >
        {imageUrl ? <img src={resolveAssetUrl(imageUrl)} alt="" /> : <IconCamera size={18} />}
        {uploading && <span className="food-photo-uploading" />}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleFile} />
    </>
  );
}

// Uma refeição (nome + opções lado a lado, cada uma com os seus elementos).
// Usado tanto no formulário do plano inteiro como ao editar só uma refeição
// a partir do cartão do plano. Componente controlado: `onChange(meal)`
// recebe a refeição já alterada. `onRemove` é opcional (sem ele não aparece
// o botão de remover a refeição).
export default function MealEditor({ meal, onChange, onRemove, canRemove = true, onError }) {
  // Elemento para o qual a pesquisa de produtos está aberta, ou null.
  const [searchTarget, setSearchTarget] = useState(null);
  const { icon: MealIcon, color } = mealVisual(meal.name);

  function setOptions(options) {
    onChange({ ...meal, options });
  }

  function updateItem(optIndex, itemIndex, changes) {
    setOptions(
      meal.options.map((option, j) =>
        j !== optIndex
          ? option
          : { ...option, items: option.items.map((item, k) => (k === itemIndex ? { ...item, ...changes } : item)) }
      )
    );
  }

  function addItem(optIndex) {
    setOptions(meal.options.map((option, j) => (j !== optIndex ? option : { ...option, items: [...option.items, emptyItem()] })));
  }

  function removeItem(optIndex, itemIndex) {
    setOptions(
      meal.options.map((option, j) =>
        j !== optIndex ? option : { ...option, items: option.items.filter((_, k) => k !== itemIndex) }
      )
    );
  }

  // Produto escolhido na pesquisa: preenche nome, foto, marca e valores.
  function applyProduct(product) {
    updateItem(searchTarget.optIndex, searchTarget.itemIndex, {
      food_name: product.name,
      brand: product.brand,
      image_url: product.image_url,
      off_code: product.code,
      kcal_100g: product.kcal_100g,
      protein_100g: product.protein_100g,
      carbs_100g: product.carbs_100g,
      fat_100g: product.fat_100g,
    });
    setSearchTarget(null);
  }

  return (
    <div className="nf-meal" style={{ "--meal-color": color }}>
      <div className="nf-meal-header">
        <span className="nf-meal-icon">
          <MealIcon size={20} />
        </span>
        <div className="nf-meal-name">
          <input
            type="text"
            className="glass-input"
            value={meal.name}
            onChange={(e) => onChange({ ...meal, name: e.target.value })}
            placeholder="Ex: Pequeno-almoço"
            aria-label="Nome da refeição"
            required
          />
          <IconPencil size={16} />
        </div>
        {onRemove && (
          <button type="button" className="nf-text-danger" onClick={onRemove} disabled={!canRemove}>
            <IconTrash size={17} />
            Remover refeição
          </button>
        )}
      </div>

      <div className="nf-options">
        {meal.options.map((option, optIndex) => (
          <div className="nf-option" key={optIndex}>
            <div className="nf-option-header">
              <span className="nf-option-pill">Opção {optIndex + 1}</span>
              <button
                type="button"
                className="nf-icon-danger"
                onClick={() => setOptions(meal.options.filter((_, j) => j !== optIndex))}
                disabled={meal.options.length === 1}
                title="Remover opção"
                aria-label={`Remover opção ${optIndex + 1}`}
              >
                <IconTrash size={17} />
              </button>
            </div>

            <div className="meal-item-row-header">
              <span>Foto</span>
              <span>Elemento</span>
              <span>Quantidade</span>
              <span></span>
            </div>
            {option.items.map((item, itemIndex) => (
              <div className="meal-item-row" key={itemIndex}>
                <FoodPhotoButton
                  imageUrl={item.image_url}
                  onUploaded={(imageUrl) => updateItem(optIndex, itemIndex, { image_url: imageUrl })}
                  onError={onError}
                />
                <div className="meal-item-name">
                  <div className="meal-item-name-input">
                    <input
                      type="text"
                      className="glass-input"
                      value={item.food_name}
                      onChange={(e) => updateItem(optIndex, itemIndex, { food_name: e.target.value })}
                      placeholder="Ex: Ovos"
                      aria-label="Elemento"
                      required
                    />
                    <button
                      type="button"
                      className="meal-item-search"
                      onClick={() => setSearchTarget({ optIndex, itemIndex })}
                      title="Pesquisar produto do supermercado"
                      aria-label="Pesquisar produto do supermercado"
                    >
                      <IconSearch size={16} />
                    </button>
                  </div>
                  {(item.brand || item.kcal_100g != null) && (
                    <span className="meal-item-meta">
                      {[item.brand, item.kcal_100g != null && `${item.kcal_100g} kcal/100 g`].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  className="glass-input"
                  value={item.quantity}
                  onChange={(e) => updateItem(optIndex, itemIndex, { quantity: e.target.value })}
                  placeholder="Ex: 2 unidades"
                  aria-label="Quantidade"
                />
                <button
                  type="button"
                  className="nf-icon-danger"
                  onClick={() => removeItem(optIndex, itemIndex)}
                  disabled={option.items.length === 1}
                  title="Remover elemento"
                  aria-label="Remover elemento"
                >
                  <IconTrash size={17} />
                </button>
              </div>
            ))}
            <button type="button" className="log-add-set-inline" onClick={() => addItem(optIndex)}>
              <IconPlusCircle size={16} />
              Adicionar elemento
            </button>
          </div>
        ))}
      </div>

      <button type="button" className="log-add-set" onClick={() => setOptions([...meal.options, emptyOption()])}>
        <IconPlusCircle size={18} />
        Adicionar opção
      </button>

      {searchTarget && (
        <FoodSearchModal
          initialQuery={meal.options[searchTarget.optIndex].items[searchTarget.itemIndex].food_name}
          onSelect={applyProduct}
          onClose={() => setSearchTarget(null)}
        />
      )}
    </div>
  );
}
