import express from "express";
import { addChapter, getChapters, getChaptersFromSubject, updateChapterAvailability } from "../controllers/chapterController.js";
import { verifyAdmin } from "../middlewares/verifyToken.js";
const router = express.Router();
router.get("/", getChapters);
router.get("/subject/:id", getChaptersFromSubject);
router.post("/", verifyAdmin, addChapter);
router.put("/:id", verifyAdmin, updateChapterAvailability);
export default router;
