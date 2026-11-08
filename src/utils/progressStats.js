export function summarizeProgress(chapters, submissions) {
  const bestByQuiz = new Map();
  for (const submission of submissions || []) {
    const id = String(submission.quizId?._id || submission.quizId || '');
    const score = submission.bestScore ?? submission.score;
    if (typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100) bestByQuiz.set(id, Math.max(bestByQuiz.get(id) ?? 0, score));
  }
  let total = 0,
    completed = 0;
  const data = (chapters || []).map(chapter => {
    const quizzes = (chapter.quizzes || []).filter(quiz => quiz.availability !== false);
    const scores = quizzes.map(quiz => bestByQuiz.get(String(quiz._id))).filter(score => score !== undefined);
    const sum = scores.reduce((a, b) => a + b, 0);
    total += sum;
    completed += scores.length;
    return {
      id: chapter._id,
      name: chapter.name,
      avg: scores.length ? Number((sum / scores.length).toFixed(1)) : null,
      completed: scores.length,
      total: quizzes.length
    };
  });
  return {
    data,
    completed,
    overall: completed ? Number((total / completed).toFixed(1)) : null
  };
}
