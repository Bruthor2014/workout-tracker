// Corre uma vez, depois de configurares SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
// (ver .env.example), para enviar o que já está em backend/uploads/ para o
// bucket e atualizar os avatar_url/image_url na base de dados. Depois disto,
// os novos uploads já vão direto para o Supabase Storage (ver
// services/storage.js) — isto só trata do que ficou para trás em disco.
//
// Uso: node scripts/migrateUploadsToSupabase.js

require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const pool = require("../db/pool");

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "uploads";

const MIME_BY_EXT = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

async function migrateFolder(supabase, folder, table, column, urlPrefix) {
  const dir = path.join(__dirname, "..", "uploads", folder);
  if (!fs.existsSync(dir)) {
    console.log(`(sem pasta ${folder}, a saltar)`);
    return;
  }

  const files = fs.readdirSync(dir).filter((f) => f !== ".gitkeep");
  console.log(`${folder}: ${files.length} ficheiro(s) a migrar`);

  for (const filename of files) {
    const localPath = path.join(dir, filename);
    const buffer = fs.readFileSync(localPath);
    const ext = path.extname(filename).toLowerCase();
    const storagePath = `${folder}/${filename}`;
    const oldUrl = `${urlPrefix}/${folder}/${filename}`;

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: MIME_BY_EXT[ext] || "application/octet-stream",
      upsert: true,
    });
    if (error) {
      console.error(`  ✗ ${filename}: ${error.message}`);
      continue;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const result = await pool.query(`UPDATE ${table} SET ${column} = $1 WHERE ${column} = $2`, [
      data.publicUrl,
      oldUrl,
    ]);
    console.log(`  ✓ ${filename} → ${result.rowCount} registo(s) atualizado(s)`);
  }
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Falta SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no .env — ver .env.example.");
    process.exit(1);
  }
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  await migrateFolder(supabase, "avatars", "users", "avatar_url", "/uploads");
  await migrateFolder(supabase, "foods", "meal_option_items", "image_url", "/uploads");

  await pool.end();
  console.log("Concluído.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
