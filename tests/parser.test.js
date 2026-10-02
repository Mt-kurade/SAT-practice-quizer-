const assert = require("node:assert/strict");
const {
  parseQuestionText,
  parseSatPages,
  parseAcceptedAnswers,
  isAcceptedResponse,
  textItemsToLines,
  suggestDeckName,
} = require("../parser.js");

const acceptanceQuestion = `
Question ID: 37e5c794
Assessment
SAT
Test
Reading and Writing
Domain
Standard English Conventions
Skill
Form, Structure, and Sense
Difficulty
Hard
Question
Despite being cheap, versatile, and easy to produce, ______ they are made from nonrenewable petroleum, and most do not biodegrade in landfills.
Which choice completes the text so that it conforms to the conventions of Standard English?
Answer
A. there are two problems associated with commercial plastics:
B. two problems are associated with commercial plastics:
C. commercial plastics’ two associated problems are that
D. commercial plastics have two associated problems:
Correct Answer: D
Rationale
Choice D is the best answer. The convention being tested is sentence structure.
`;

const parsed = parseQuestionText(acceptanceQuestion, 3);
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.question.questionId, "37e5c794");
assert.equal(parsed.question.correctAnswer, "D");
assert.equal(parsed.question.answers.A, "there are two problems associated with commercial plastics:");
assert.equal(parsed.question.answers.D, "commercial plastics have two associated problems:");
assert.equal(parsed.question.prompt, "Which choice completes the text so that it conforms to the conventions of Standard English?");
assert.match(parsed.question.passage, /Despite being cheap/);
assert.equal(parsed.question.sourcePage, 3);
assert.equal(parsed.question.incorrectAttempts, 0);
assert.equal(parsed.question.lastIncorrectAnswer, null);

const withBadPage = parseSatPages(["A scanned page with no extractable question.", acceptanceQuestion]);
assert.equal(withBadPage.questions.length, 1);
assert.equal(withBadPage.diagnostics.length, 2);
assert.equal(withBadPage.diagnostics[0].success, false);
assert.equal(withBadPage.diagnostics[1].success, true);

assert.equal(
  suggestDeckName([parsed.question], "export.pdf"),
  "Reading & Writing — Standard English Conventions — Hard",
);

const reconstructed = textItemsToLines([
  { str: "Answer", transform: [1, 0, 0, 1, 10, 80], width: 30 },
  { str: "A.", transform: [1, 0, 0, 1, 10, 60], width: 10 },
  { str: "First choice", transform: [1, 0, 0, 1, 25, 60], width: 50 },
]);
assert.equal(reconstructed, "Answer\nA. First choice");

const mathMultipleChoice = `
Question ID: math-mcq-1
Assessment
SAT
Test
Math
Domain
Advanced Math
Skill
Nonlinear equations
Difficulty
Medium
Question
The equation x² - 5x + 6 = 0 has two solutions. What is the product of the solutions?
Answer
A. 2
B. 3
C. 5
D. 6
Correct Answer: D
Rationale
The solutions are 2 and 3, so their product is 6.
`;

const parsedMathChoice = parseQuestionText(mathMultipleChoice, 4);
assert.deepEqual(parsedMathChoice.errors, []);
assert.equal(parsedMathChoice.question.test, "Math");
assert.equal(parsedMathChoice.question.responseType, "multiple-choice");
assert.equal(parsedMathChoice.question.passage, "");
assert.match(parsedMathChoice.question.prompt, /x² - 5x/);
assert.equal(parsedMathChoice.question.answers.D, "6");
assert.equal(parsedMathChoice.question.correctAnswer, "D");

const graphicalMathChoices = mathMultipleChoice
  .replace("A. 2\nB. 3\nC. 5\nD. 6", "A.\nB.\nC.\nD.");
const parsedGraphicalChoices = parseQuestionText(graphicalMathChoices, 4);
assert.deepEqual(parsedGraphicalChoices.errors, []);
assert.deepEqual(Object.keys(parsedGraphicalChoices.question.answers), ["A", "B", "C", "D"]);

const mathStudentProduced = `
Question ID: math-spr-1
Assessment: SAT
Test: Math
Domain: Algebra
Skill: Linear equations in one variable
Difficulty: Easy
Question:
If 3x = 2, what is the value of x?
Answer:
Correct Answer: 2/3 or .6666666667
Rationale:
Dividing both sides of 3x = 2 by 3 gives x = 2/3.
`;

const parsedMathSpr = parseQuestionText(mathStudentProduced, 5);
assert.deepEqual(parsedMathSpr.errors, []);
assert.equal(parsedMathSpr.question.responseType, "student-produced");
assert.deepEqual(parsedMathSpr.question.acceptedAnswers, ["2/3", ".6666666667"]);
assert.equal(parsedMathSpr.question.correctAnswer, "2/3 or .6666666667");
assert.deepEqual(parseAcceptedAnswers("1,000; 1000"), ["1,000", "1000"]);
assert.deepEqual(parseAcceptedAnswers("4, 5, or 6"), ["4", "5", "6"]);
assert.equal(isAcceptedResponse("0.5", ["1/2"]), true);
assert.equal(isAcceptedResponse("2/3", [".6666666667"]), true);
assert.equal(isAcceptedResponse("1,000", ["1000"]), true);

const mixedMathPage = parseSatPages([`${mathMultipleChoice}\n${mathStudentProduced}`]);
assert.equal(mixedMathPage.questions.length, 2);
assert.equal(mixedMathPage.diagnostics[0].success, true);

const answerBoundary = mathMultipleChoice.indexOf("Answer");
const splitMathPages = parseSatPages([
  mathMultipleChoice.slice(0, answerBoundary),
  mathMultipleChoice.slice(answerBoundary),
  mathStudentProduced,
]);
assert.equal(splitMathPages.questions.length, 2);
assert.equal(splitMathPages.questions[0].sourcePage, 1);
assert.equal(splitMathPages.questions[0].sourceEndPage, 2);
assert.deepEqual(splitMathPages.diagnostics.map((item) => item.success), [true, true, true]);

console.log("Parser tests passed: Reading and Writing, math multiple choice, math grid-ins, partial failures, naming, and line reconstruction.");
