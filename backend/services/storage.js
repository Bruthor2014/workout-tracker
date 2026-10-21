const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Guarda imagens (avatares, fotos de refeições) na Supabase Storage quando
// configurada — para o disco deixar de ser um bloqueador a correr mais do
// que um servidor. Sem as variáveis de ambiente (dev local sem Supabase
// Storage configurada), cai para disco local, exatamente como antes — não
// obriga ninguém a configurar a cloud só para correr a app localmente.
const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";
const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

function buildFilename(prefix, userId, ext) {
  return `${prefix}-${userId}-${Date.now()}${ext}`;
}

// Faz upload de uma imagem já em memória (req.file.buffer, com multer em
// modo memoryStorage — ver middleware/upload.js) para "<folder>/<nome>".
// Devolve sempre um caminho pronto a guardar em avatar_url/image_url:
// - Supabase configurada: o URL público completo (https://...).
// - Sem Supabase: "/uploads/<folder>/<nome>", servido pelo próprio
//   Express (app.use("/uploads", ...) em server.js), tal como sempre foi.
// Em ambos os casos, resolveAssetUrl no frontend já sabe lidar com as duas
// formas sem precisar de mudanças.
async function uploadImage({ buffer, mimetype, originalname, folder, prefix, userId }) {
  const ext = path.extname(originalname).toLowerCase();
  const filename = buildFilename(prefix, userId, ext);
  const storagePath = `${folder}/${filename}`;

  if (supabase) {
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: mimetype,
      upsert: false,
    });
    if (error) throw new Error(`Falha ao enviar imagem: ${error.message}`);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  }

  const destDir = path.join(__dirname, "..", "uploads", folder);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, filename), buffer);
  return `/uploads/${storagePath}`;
}

module.exports = { uploadImage };
