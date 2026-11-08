import express from "express";
import { getQuiz, addQuiz, getQuizById, deleteQuiz, updateQuizAvailability, updateQuizFull, getQuizFromChapter, getQuizBySubject, reviewQuiz, createQuizAttempt } from "../controllers/quizController.js";
import { verifyToken, verifyAdmin } from "../middlewares/verifyToken.js";
const router = express.Router();

// Read routes protected with verifyToken
router.get("/", verifyToken, getQuiz);
router.get("/chapter/:id", verifyToken, getQuizFromChapter);
router.get("/subject/:subjectid", verifyToken, getQuizBySubject);
router.get("/:id/review", verifyToken, reviewQuiz);
router.post("/:id/attempt", verifyToken, createQuizAttempt);
router.get("/:id", verifyToken, getQuizById);

// Write routes protected with verifyAdmin
router.post("/", verifyAdmin, addQuiz);
router.put("/:id/availability", verifyAdmin, updateQuizAvailability);
router.put("/:id/full", verifyAdmin, updateQuizFull);
router.delete("/:id", verifyAdmin, deleteQuiz);
export default router;
