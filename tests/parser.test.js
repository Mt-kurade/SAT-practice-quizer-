const assert = require("node:assert/strict");
const {
  parseQuestionText,
  parseSatPages,
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

const withBadPage = parseSatPages([acceptanceQuestion, "A scanned page with no extractable question."]);
assert.equal(withBadPage.questions.length, 1);
assert.equal(withBadPage.diagnostics.length, 2);
assert.equal(withBadPage.diagnostics[0].success, true);
assert.equal(withBadPage.diagnostics[1].success, false);

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

console.log("Parser tests passed: acceptance question, partial failures, naming, and line reconstruction.");
