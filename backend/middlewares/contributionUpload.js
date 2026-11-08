import multer from "multer";
import path from "node:path";

const storage = multer.memoryStorage();

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MiB

const allowedExtensions = new Set([".pdf", ".csv"]);

export function isValidPdfSignature(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  );
}

const multerUpload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!allowedExtensions.has(ext)) {
      return cb(new Error("Chỉ chấp nhận file định dạng .pdf hoặc .csv!"));
    }
    cb(null, true);
  }
}).single("file");

/**
 * Middleware handling file upload into memory for PDF or CSV preview.
 * Validates file size (max 10MB), extension (.pdf, .csv), and PDF magic bytes (%PDF-).
 */
export const contributionUpload = (req, res, next) => {
  multerUpload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Kích thước file vượt quá giới hạn cho phép (tối đa 10MB)!"
        });
      }
      return res.status(400).json({
        message: err.message || "Lỗi khi tải lên file!"
      });
    }

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({
        message: "Vui lòng chọn file PDF hoặc CSV để tải lên!"
      });
    }

    const ext = path.extname(req.file.originalname || "").toLowerCase();
    if (!allowedExtensions.has(ext)) {
      return res.status(400).json({
        message: "Chỉ chấp nhận file định dạng .pdf hoặc .csv!"
      });
    }

    if (req.file.buffer.length === 0) {
      return res.status(400).json({
        message: "File tải lên không có dữ liệu (file rỗng)!"
      });
    }

    if (ext === ".pdf") {
      // Validate PDF signature: Must begin with "%PDF-" (0x25, 0x50, 0x44, 0x46, 0x2D)
      if (!isValidPdfSignature(req.file.buffer)) {
        return res.status(400).json({
          message: "File không hợp lệ: Thiếu chữ ký PDF (%PDF-)."
        });
      }
    }

    next();
  });
};

export default contributionUpload;
