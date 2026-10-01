const assert = require("node:assert/strict");
const { analyzeQuestion, analyzeWeakSpots } = require("../analysis.js");

function missedQuestion(overrides = {}) {
  return {
    questionId: "e44db0a0",
    domain: "Standard English Conventions",
    skill: "",
    difficulty: "Medium",
    passage: "A cycle of lunar phases ______ about twenty-nine days.",
    prompt: "Which choice completes the text so that it conforms to Standard English?",
    answers: { A: "are taking", B: "have taken", C: "take", D: "takes" },
    rationale: "Choice D is the best answer. The convention being tested is subject-verb agreement. The singular verb takes agrees in number with the singular subject a cycle of lunar phases. Choice A is incorrect because the plural verb are taking doesn't agree in number with the singular subject a cycle of lunar phases.",
    incorrectAttempts: 3,
    mistakeHistory: [{ answer: "A" }, { answer: "A" }, { answer: "B" }],
    ...overrides,
  };
}

const subjectVerb = analyzeQuestion(missedQuestion());
assert.equal(subjectVerb[0].label, "Subject–verb agreement");
assert.match(subjectVerb[0].evidence, /plural verb are taking/i);

const oneQuestionManyAttempts = analyzeWeakSpots([missedQuestion()]);
assert.equal(oneQuestionManyAttempts[0].repeated, false, "Multiple attempts on one question are not a repeated pattern");
assert.equal(oneQuestionManyAttempts[0].attempts, 3);

const possessiveRationale = "The convention being tested is plural possessives. Because the owners are multiple researchers and the plural noun ends in s, the apostrophe belongs after the final s.";
const repeatedPossessive = analyzeWeakSpots([
  missedQuestion({ questionId: "p1", rationale: possessiveRationale, incorrectAttempts: 1, mistakeHistory: [{ answer: "A" }] }),
  missedQuestion({ questionId: "p2", rationale: possessiveRationale, incorrectAttempts: 2, mistakeHistory: [{ answer: "B" }, { answer: "C" }] }),
]);
const possessiveGroup = repeatedPossessive.find((group) => group.id === "plural-possessives");
assert.ok(possessiveGroup);
assert.equal(possessiveGroup.repeated, true);
assert.equal(possessiveGroup.questions.length, 2);
assert.equal(possessiveGroup.attempts, 3);

const derived = analyzeQuestion(missedQuestion({ rationale: "The convention being tested is logical comparison.", skill: "" }));
assert.equal(derived[0].label, "Logical Comparison");

console.log("Content analysis tests passed: rule diagnosis, selected-choice evidence, and cross-question patterns.");
