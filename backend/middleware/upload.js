const multer = require("multer");

function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    const err = new Error("Formato de imagem não suportado (usa JPEG, PNG ou WEBP).");
    err.statusCode = 400;
    return cb(err);
  }
  cb(null, true);
}

// Guarda o ficheiro em memória (req.file.buffer), não em disco — o
// controller é que decide o destino final através de services/storage.js
// (Supabase Storage quando configurada, senão disco local). Sem isto, o
// ficheiro ficaria preso ao disco do servidor que recebeu o pedido, o que
// impede correr mais do que uma instância da app.
//
// 8MB: uma foto tirada diretamente com a câmara de um telemóvel ronda
// normalmente os 3-6MB — o limite anterior (3MB) cortava o upload a meio
// (o multer/busboy param de ler o ficheiro mas o browser continua a
// enviá-lo, e a ligação acaba por fechar com "Unexpected end of form"),
// o que o handler de erro genérico mostrava sempre como "Erro interno do
// servidor" em vez de avisar que a foto era grande demais.
function imageUpload() {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 8 * 1024 * 1024 },
  });
}

const uploadAvatar = imageUpload();
const uploadFoodPhoto = imageUpload();
const uploadExercisePhoto = imageUpload();
const uploadSessionPhoto = imageUpload();
const uploadPlanPhoto = imageUpload();

module.exports = { uploadAvatar, uploadFoodPhoto, uploadExercisePhoto, uploadSessionPhoto, uploadPlanPhoto };
