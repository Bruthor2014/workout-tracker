const multer = require("multer");

function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Formato de imagem não suportado (usa JPEG, PNG ou WEBP)."));
  }
  cb(null, true);
}

// Guarda o ficheiro em memória (req.file.buffer), não em disco — o
// controller é que decide o destino final através de services/storage.js
// (Supabase Storage quando configurada, senão disco local). Sem isto, o
// ficheiro ficaria preso ao disco do servidor que recebeu o pedido, o que
// impede correr mais do que uma instância da app.
function imageUpload() {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  });
}

const uploadAvatar = imageUpload();
const uploadFoodPhoto = imageUpload();
const uploadExercisePhoto = imageUpload();

module.exports = { uploadAvatar, uploadFoodPhoto, uploadExercisePhoto };
