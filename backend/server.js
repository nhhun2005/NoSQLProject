import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";
import questionRoutes from "./routes/questionRoutes.js";
import questionImageRoutes from "./routes/questionImageRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import submissionRoutes from "./routes/submissionRoutes.js";
import subjectRoutes from "./routes/subjectRoutes.js";
import chapterRoutes from "./routes/chapterRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import contributeRoutes from "./routes/contributeRoutes.js";
import pingRoutes from "./routes/pingRoutes.js";
dotenv.config();
const app = express();
if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
  throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must be configured");
}
await connectDB();
app.use(cors());
app.use("/api/contributed", contributeRoutes);
app.use(express.json());
app.use("/api/questions", questionRoutes);
app.use("/api/questionImages", questionImageRoutes);
app.use("/api/quizzes", quizRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/chapters", chapterRoutes);
app.use("/api/users", userRoutes);
app.use("/api/auth", authRoutes);

//thang o duoi ko can quan tam
app.use("/api/ping", pingRoutes);
//dung quan tam thang o tren
// Keep error payloads predictable and never serialize internal/provider errors.
app.use((err, req, res, _next) => {
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    message: status === 413 ? 'File vượt quá dung lượng cho phép.' : status < 500 ? 'Yêu cầu không hợp lệ.' : 'Không thể xử lý yêu cầu, vui lòng thử lại.'
  });
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
