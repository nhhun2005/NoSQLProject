import express from "express";
import upload from "../middlewares/uploadMiddleware.js";
import contributionUpload from "../middlewares/contributionUpload.js";
import { verifyToken, verifyAdmin } from "../middlewares/verifyToken.js";
import {
  handleCSVUpload,
  approveContribution,
  getAllContributedQuizzes,
  rejectContribution,
  getDetailContributedQuiz,
  getContributedQuizzesPaginated,
  getContributionStats,
} from "../controllers/contributeController.js";
import {
  importContributionPreview,
  submitContribution,
} from "../controllers/contributionImportController.js";

const router = express.Router();

// Upload CSV cũ để giữ tính tương thích ngược
router.post("/uploadCSV", verifyToken, upload.single("file"), handleCSVUpload);

// Import trích xuất xem trước (PDF / CSV) - KHÔNG ghi DB, giới hạn 10MB
router.post("/import", verifyToken, contributionUpload, importContributionPreview);

// Gửi đề đóng góp chính thức sau khi xem trước và xác nhận - kiểm tra nghiêm ngặt
router.post("/submit", verifyToken, express.json({ limit: "2mb" }), submitContribution);

router.put("/approve/:id", verifyAdmin, approveContribution);
router.get("/", verifyAdmin, getAllContributedQuizzes);
router.get("/paginated", verifyAdmin, getContributedQuizzesPaginated);
router.get("/stats", verifyToken, getContributionStats);
router.put("/reject/:id", verifyAdmin, rejectContribution);
router.get("/:id", verifyAdmin, getDetailContributedQuiz);

export default router;
