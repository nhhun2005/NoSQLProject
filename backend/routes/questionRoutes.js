import express from "express";
import { getQuestions, addQuestion, deleteQuestion, getQuestionsById } from "../controllers/questionController.js";
import { verifyAdmin } from "../middlewares/verifyToken.js";
const router = express.Router();

// Raw questions endpoints are restricted to Admin only (normal users interact via Quiz APIs)
router.get("/", verifyAdmin, getQuestions);
router.get("/:id", verifyAdmin, getQuestionsById);
router.get("/quiz/:id", verifyAdmin, getQuestionsById);
router.post("/", verifyAdmin, addQuestion);
router.delete("/:id", verifyAdmin, deleteQuestion);
export default router;
