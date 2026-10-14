const multer = require("multer");
const path = require("path");

function fileFilter(req, file, cb) {
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Formato de imagem não suportado (usa JPEG, PNG ou WEBP)."));
  }
  cb(null, true);
}

// Upload de uma imagem para uploads/<folder>/ (o multer cria a pasta se não
// existir), com nome "<prefix>-<id do utilizador>-<timestamp>.<ext>".
// requireAuth tem de correr antes, porque o nome usa req.user.id.
function imageUpload(folder, prefix) {
  const storage = multer.diskStorage({
    destination: path.join(__dirname, "..", "uploads", folder),
    filename(req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${prefix}-${req.user.id}-${Date.now()}${ext}`);
    },
  });

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  });
}

const uploadAvatar = imageUpload("avatars", "user");
const uploadFoodPhoto = imageUpload("foods", "food");

module.exports = { uploadAvatar, uploadFoodPhoto };
