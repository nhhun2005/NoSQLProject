/** Keep wrong and unanswered questions so a new practice round never drops unfinished work. */
export function getPracticeRetryState(questions, answers) {
  const retryQuestions = [];
  let wrong = 0;
  let unanswered = 0;
  for (const question of questions) {
    const selected = answers[question._id];
    if (selected === undefined || selected === null || selected === '') {
      unanswered++;
      retryQuestions.push(question);
    } else if (selected !== question.answer) {
      wrong++;
      retryQuestions.push(question);
    }
  }
  return { questions: retryQuestions, wrong, unanswered };
}
