// Pesquisa de produtos alimentares para os planos de nutrição, via Open Food
// Facts (https://world.openfoodfacts.org) — base de dados aberta e gratuita,
// com produtos vendidos em Portugal (incluindo marcas próprias do
// Continente, Pingo Doce, Lidl, ...), fotos e valores nutricionais. Os
// supermercados não têm API pública; o Open Food Facts é a alternativa legal.
//
// O pedido passa pelo backend (e não diretamente do browser) para: enviar o
// User-Agent identificativo que o Open Food Facts pede, e guardar os
// resultados em cache.
//
// Duas fontes:
// 1. API clássica (cgi/search.pl) — melhor cobertura de produtos portugueses
//    e melhor relevância, mas lenta na 1.ª vez que vê um termo (~10s) e às
//    vezes responde "Page temporarily unavailable" (HTTP 503). Daí o timeout
//    largo e as novas tentativas.
// 2. search.openfoodfacts.org — rápida e estável, mas com menos produtos
//    portugueses e pior relevância; usada só se a clássica falhar de vez.

const USER_AGENT = "WorkoutTracker/0.1 (https://github.com/Bruthor2014/workout-tracker)";
const CLASSIC_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const FALLBACK_SEARCH_URL = "https://search.openfoodfacts.org/search";
const PAGE_SIZE = 24;
const FIELDS = "code,product_name,product_name_pt,brands,stores,quantity,image_front_small_url,image_front_url,nutriments";

const CLASSIC_TIMEOUT_MS = 25000;
const CLASSIC_RETRY_DELAYS_MS = [1000, 2500]; // pausas antes da 2.ª e 3.ª tentativas
const FALLBACK_TIMEOUT_MS = 8000;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const CACHE_MAX_ENTRIES = 500;
const cache = new Map(); // termo normalizado -> { at, results }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

// As duas fontes devolvem marcas/lojas em formatos diferentes: texto
// separado por vírgulas (clássica) ou lista (search.openfoodfacts.org).
function toList(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return list.map((s) => String(s).trim()).filter(Boolean);
}

function toProduct(p) {
  const n = p.nutriments || {};
  return {
    code: p.code,
    name: (p.product_name_pt || p.product_name || "").trim(),
    brand: toList(p.brands)[0] || null,
    stores: toList(p.stores).slice(0, 3),
    package_quantity: p.quantity || null,
    image_url: p.image_front_small_url || p.image_front_url || null,
    kcal_100g: toNumber(n["energy-kcal_100g"]),
    protein_100g: toNumber(n.proteins_100g),
    carbs_100g: toNumber(n.carbohydrates_100g),
    fat_100g: toNumber(n.fat_100g),
  };
}

// GET JSON; devolve null em qualquer falha (timeout, HTTP != 2xx, ou HTML
// em vez de JSON, que é o que o Open Food Facts devolve quando recusa).
async function fetchJson(url, timeoutMs) {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return await response.json().catch(() => null);
  } catch {
    return null;
  }
}

async function searchClassic(query) {
  const params = new URLSearchParams({
    search_terms: query,
    countries_tags_en: "portugal",
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(PAGE_SIZE),
    fields: FIELDS,
  });
  const url = `${CLASSIC_SEARCH_URL}?${params}`;

  for (let attempt = 0; attempt <= CLASSIC_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) await sleep(CLASSIC_RETRY_DELAYS_MS[attempt - 1]);
    const data = await fetchJson(url, CLASSIC_TIMEOUT_MS);
    if (data && Array.isArray(data.products)) return data.products;
  }
  return null;
}

async function searchFallback(query) {
  const params = new URLSearchParams({
    q: `${query} countries_tags:"en:portugal"`,
    page_size: String(PAGE_SIZE),
    fields: FIELDS,
  });
  const data = await fetchJson(`${FALLBACK_SEARCH_URL}?${params}`, FALLBACK_TIMEOUT_MS);
  return data && Array.isArray(data.hits) ? data.hits : null;
}

// GET /api/foods/search?q=iogurte grego continente
async function searchFoods(req, res) {
  const query = (req.query.q || "").trim();
  if (query.length < 2) {
    return res.status(400).json({ message: "Escreve pelo menos 2 letras para pesquisar." });
  }

  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return res.json(cached.results);
  }

  const products = (await searchClassic(query)) || (await searchFallback(query));
  if (!products) {
    return res
      .status(503)
      .json({ message: "A pesquisa de produtos está indisponível de momento. Tenta outra vez daqui a um minuto." });
  }

  const results = products.map(toProduct).filter((p) => p.name);

  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), results });

  res.json(results);
}

// POST /api/foods/photo — foto própria de um alimento (ex: algo que não
// existe no Open Food Facts). O ficheiro já foi gravado pelo multer; devolve
// o caminho para guardar no item do plano.
function uploadFoodPhoto(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Nenhuma imagem enviada." });
  }
  res.status(201).json({ image_url: `/uploads/foods/${req.file.filename}` });
}

module.exports = { searchFoods, uploadFoodPhoto };
