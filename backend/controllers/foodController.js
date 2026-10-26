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

const { uploadImage } = require("../services/storage");

const USER_AGENT = "WorkoutTracker/0.1 (https://github.com/Bruthor2014/workout-tracker)";
const CLASSIC_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const FALLBACK_SEARCH_URL = "https://search.openfoodfacts.org/search";
const PAGE_SIZE = 24;
const FIELDS = "code,product_name,product_name_pt,brands,stores,quantity,image_front_small_url,image_front_url,nutriments";

const CLASSIC_TIMEOUT_MS = 10000;
const CLASSIC_RETRY_DELAYS_MS = [1200]; // pausa antes da 2.ª tentativa
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

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // acentos
    .toLowerCase()
    .trim();
}

// Nenhuma das duas fontes do Open Food Facts ordena bem por relevância ao
// termo em si (ex: "bife de peru" devolvia "Bife de Atum" antes de "Peito
// de peru") — reordena localmente: match exato > nome começa pelo termo >
// termo aparece inteiro no nome > quantas mais palavras do termo aparecem
// (nalguma ordem), mais acima > nenhuma palavra bate certo. Exigir TODAS as
// palavras batesse certo era rígido de mais — "bife de peru" quase nunca
// aparece assim escrito, "peito de peru" já devia contar por ter "peru".
const STOPWORDS = new Set(["de", "da", "do", "das", "dos", "e", "com", "sem", "a", "o", "em"]);
const NO_MATCH_SCORE = 100;

function sortByRelevance(results, query) {
  const q = normalize(query);
  // Preposições/artigos fora daqui — exigir que "de" apareça literalmente
  // no nome do produto é demasiado rígido e mascarava bons resultados
  // (ex: "frango" sozinho já devia contar em "bife de frango").
  const words = q.split(/\s+/).filter((w) => w.length > 0 && !STOPWORDS.has(w));
  function score(product) {
    const name = normalize(product.name);
    if (name === q) return 0;
    if (name.startsWith(q)) return 1;
    if (name.includes(q)) return 2;
    const matched = words.filter((w) => name.includes(w)).length;
    // Mais palavras a bater certo = número mais baixo = mais acima; nunca
    // tão bom quanto conter a frase toda (nível 2).
    return matched > 0 ? 10 - matched : NO_MATCH_SCORE;
  }
  results.forEach((p) => {
    p._score = score(p);
  });
  // Dentro do mesmo nível de relevância (exceto o nível 4 — "não bateu
  // mesmo nada certo", onde promover por foto só trazia produtos
  // aleatórios lá para cima, ex: whisky a aparecer em "bife de peru"),
  // os que já têm foto primeiro — mais úteis visualmente.
  results.sort((a, b) => {
    if (a._score !== b._score) return a._score - b._score;
    if (a._score === NO_MATCH_SCORE) return 0;
    return (b.image_url ? 1 : 0) - (a.image_url ? 1 : 0);
  });
  results.forEach((p) => delete p._score);
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

  // As duas fontes correm ao mesmo tempo (não uma depois da outra) — a
  // clássica (search.pl) tem vindo a ficar instável (às vezes ~500ms,
  // às vezes "Page temporarily unavailable"), e esperar por ela antes de
  // tentar a rápida podia levar perto de um minuto numa pesquisa normal.
  // Usa a primeira que responder com resultados a sério; se essa falhar,
  // espera pela outra.
  const classicPromise = searchClassic(query);
  const fallbackPromise = searchFallback(query);
  let products = await Promise.race([classicPromise, fallbackPromise]);
  if (!products) {
    products = (await classicPromise) || (await fallbackPromise);
  }
  if (!products) {
    return res
      .status(503)
      .json({ message: "A pesquisa de produtos está indisponível de momento. Tenta outra vez daqui a um minuto." });
  }

  const results = products.map(toProduct).filter((p) => p.name);
  sortByRelevance(results, query);

  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), results });

  res.json(results);
}

// POST /api/foods/photo — foto própria de um alimento (ex: algo que não
// existe no Open Food Facts). O ficheiro já está em memória (ver
// middleware/upload.js); devolve o caminho para guardar no item do plano.
async function uploadFoodPhoto(req, res) {
  if (!req.file) {
    return res.status(400).json({ message: "Nenhuma imagem enviada." });
  }
  const imageUrl = await uploadImage({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    originalname: req.file.originalname,
    folder: "foods",
    prefix: "food",
    userId: req.user.id,
  });
  res.status(201).json({ image_url: imageUrl });
}

module.exports = { searchFoods, uploadFoodPhoto };
