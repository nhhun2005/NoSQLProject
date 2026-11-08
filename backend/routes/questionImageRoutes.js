import express from "express";
import { getQuestionImages, addQuestionImage, deleteQuestionImage, getQuestionImagesById } from "../controllers/questionImageController.js";
import { verifyAdmin } from "../middlewares/verifyToken.js";
const router = express.Router();

// Raw question image endpoints are restricted to Admin only (normal users interact via Quiz APIs)
router.get("/", verifyAdmin, getQuestionImages);
router.get("/:id", verifyAdmin, getQuestionImagesById);
router.post("/", verifyAdmin, addQuestionImage);
router.delete("/:id", verifyAdmin, deleteQuestionImage);
export default router;
