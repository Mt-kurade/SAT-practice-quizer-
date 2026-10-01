/**
 * Utilities for SAT Educator Question Bank PDF exports.
 * The parser deliberately works in stages so future support for tables, math,
 * and extracted page images can be added without replacing the deck model.
 */

const META_LABELS = ["Assessment", "Test", "Domain", "Skill", "Difficulty"];
const SECTION_LABELS = ["Question", "Answer", "Rationale"];

function cleanInline(value = "") {
  return value
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([“‘(])\s+/g, "$1")
    .trim();
}

function normalizeExtractedText(text = "") {
  let result = text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // PDF.js occasionally emits a label and its value as one visual line.
  // Add boundaries only for the known export labels, not arbitrary words.
  const labels = [...META_LABELS, ...SECTION_LABELS];
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`([^\\n])\\s+(${escaped})(?=\\s|$)`, "g"), "$1\n$2");
  }
  result = result.replace(/([^\n])\s+(Correct Answer\s*:)/gi, "$1\n$2");
  result = result.replace(/(Question ID\s*:\s*[A-Za-z0-9-]+)\s+(?=Assessment\b)/gi, "$1\n");
  return result.trim();
}

/** Rebuild readable rows from PDF.js items using their x/y coordinates. */
function textItemsToLines(items = []) {
  const positioned = items
    .filter((item) => item && typeof item.str === "string" && item.str.trim())
    .map((item, order) => ({
      text: item.str,
      x: Number(item.transform?.[4] ?? 0),
      y: Number(item.transform?.[5] ?? -order * 12),
      width: Number(item.width ?? 0),
      order,
    }));

  const lines = [];
  for (const item of positioned.sort((a, b) => Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x)) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map((line) => {
      const row = line.items.sort((a, b) => a.x - b.x);
      let output = "";
      let previousEnd = null;
      for (const item of row) {
        const gap = previousEnd === null ? 0 : item.x - previousEnd;
        const needsSpace = output && !/\s$/.test(output) && !/^\s/.test(item.text) && gap > 0.8;
        output += `${needsSpace ? " " : ""}${item.text}`;
        previousEnd = Math.max(previousEnd ?? item.x, item.x + item.width);
      }
      return cleanInline(output);
    })
    .filter(Boolean)
    .join("\n");
}

function markerRange(text, marker, from = 0) {
  const lines = text.split("\n");
  let offset = 0;
  for (const line of lines) {
    const start = offset;
    const end = start + line.length;
    if (start >= from && cleanInline(line).toLowerCase() === marker.toLowerCase()) {
      return { start, contentStart: Math.min(text.length, end + 1) };
    }
    offset = end + 1;
  }
  return null;
}

function metadataValue(header, label) {
  const lines = header.split("\n").map(cleanInline).filter(Boolean);
  const index = lines.findIndex((line) => line.toLowerCase() === label.toLowerCase());
  if (index < 0) return "";
  const blocked = new Set([...META_LABELS, ...SECTION_LABELS].map((item) => item.toLowerCase()));
  const values = [];
  for (let i = index + 1; i < lines.length && !blocked.has(lines[i].toLowerCase()) && !/^Question ID\s*:/i.test(lines[i]); i += 1) {
    values.push(lines[i]);
  }
  return cleanInline(values.join(" "));
}

function splitQuestionBody(body) {
  const cleaned = body.replace(/\n{3,}/g, "\n\n").trim();
  const starter = /(?:^|\n)(Which choice|According to|Based on|What does|What is|How does|How would|Why does|The student wants|Which finding|Which quotation|Which statement|Which conclusion|Which response|Which transition|Which of the following)\b/im;
  const match = starter.exec(cleaned);
  if (match) {
    const index = match.index + (match[0].startsWith("\n") ? 1 : 0);
    return {
      passage: cleanMultiline(cleaned.slice(0, index)),
      prompt: cleanMultiline(cleaned.slice(index)),
    };
  }

  // Fallback: use the final group ending in a question mark as the prompt.
  const paragraphs = cleaned.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length > 1 && /[?]$/.test(paragraphs.at(-1).trim())) {
    return { passage: cleanMultiline(paragraphs.slice(0, -1).join("\n\n")), prompt: cleanMultiline(paragraphs.at(-1)) };
  }
  return { passage: "", prompt: cleanMultiline(cleaned) };
}

function cleanMultiline(text = "") {
  return text
    .split("\n")
    .map(cleanInline)
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseAnswers(answerText) {
  // Option starts can share a visual line in compact exports.
  const prepared = `\n${answerText.replace(/\s+([A-D])[.)]\s+/g, "\n$1. ")}`;
  const starts = [...prepared.matchAll(/(?:^|\n)\s*([A-D])[.)]\s*/gim)];
  const answers = {};
  starts.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = starts[index + 1]?.index ?? prepared.length;
    answers[match[1].toUpperCase()] = cleanMultiline(prepared.slice(start, end));
  });
  return answers;
}

function validateQuestion(question) {
  const errors = [];
  if (!question.questionId) errors.push("Question ID was not found");
  if (!question.passage && !question.prompt) errors.push("Question text was not found");
  if (Object.keys(question.answers).length < 2) errors.push("Fewer than two answer choices were found");
  if (!/^[A-D]$/.test(question.correctAnswer)) errors.push("Correct answer was not found");
  if (question.correctAnswer && !question.answers[question.correctAnswer]) errors.push("Correct answer is missing from the parsed choices");
  return errors;
}

function parseQuestionText(rawText, pageNumber = 1) {
  const text = normalizeExtractedText(rawText);
  const idMatch = /Question ID\s*:\s*([A-Za-z0-9-]+)/i.exec(text);
  const questionMarker = markerRange(text, "Question", idMatch?.index ?? 0);
  const answerMarker = questionMarker ? markerRange(text, "Answer", questionMarker.contentStart) : null;
  const correctMatch = /Correct Answer\s*:\s*([A-D])/i.exec(text);
  const rationaleMarker = markerRange(text, "Rationale", correctMatch?.index ?? 0);

  const headerEnd = questionMarker?.start ?? text.length;
  const questionEnd = answerMarker?.start ?? correctMatch?.index ?? text.length;
  const answerEnd = correctMatch?.index ?? rationaleMarker?.start ?? text.length;
  const questionBody = questionMarker ? text.slice(questionMarker.contentStart, questionEnd) : "";
  const answerBody = answerMarker ? text.slice(answerMarker.contentStart, answerEnd) : "";
  const rationale = rationaleMarker ? cleanMultiline(text.slice(rationaleMarker.contentStart)) : "";
  const body = splitQuestionBody(questionBody);

  const question = {
    questionId: idMatch?.[1] ?? "",
    assessment: metadataValue(text.slice(0, headerEnd), "Assessment"),
    test: metadataValue(text.slice(0, headerEnd), "Test"),
    domain: metadataValue(text.slice(0, headerEnd), "Domain"),
    skill: metadataValue(text.slice(0, headerEnd), "Skill"),
    difficulty: metadataValue(text.slice(0, headerEnd), "Difficulty"),
    passage: body.passage,
    prompt: body.prompt,
    answers: parseAnswers(answerBody),
    correctAnswer: correctMatch?.[1]?.toUpperCase() ?? "",
    rationale,
    selectedAnswer: null,
    answered: false,
    correct: null,
    incorrectAttempts: 0,
    lastIncorrectAnswer: null,
    mistakeHistory: [],
    sourcePage: pageNumber,
    media: [],
  };

  return { question, errors: validateQuestion(question), extractedText: text };
}

/** Parse pages independently; a malformed page never invalidates good pages. */
function parseSatPages(pageTexts) {
  const questions = [];
  const diagnostics = [];

  pageTexts.forEach((rawText, index) => {
    const pageNumber = index + 1;
    const normalized = normalizeExtractedText(rawText);
    const idStarts = [...normalized.matchAll(/Question ID\s*:/gi)].map((match) => match.index);
    const chunks = idStarts.length
      ? idStarts.map((start, i) => normalized.slice(start, idStarts[i + 1] ?? normalized.length))
      : [normalized];

    const pageResults = chunks.map((chunk) => parseQuestionText(chunk, pageNumber));
    const successful = pageResults.filter((result) => result.errors.length === 0);
    questions.push(...successful.map((result) => result.question));
    const allErrors = pageResults.filter((result) => result.errors.length).flatMap((result) => result.errors);
    diagnostics.push({
      pageNumber,
      success: successful.length > 0,
      questionIds: pageResults.map((result) => result.question.questionId).filter(Boolean),
      errors: allErrors,
      extractedText: normalized,
    });
  });

  return { questions, diagnostics };
}

function suggestDeckName(questions, sourceFileName = "SAT Practice") {
  if (!questions.length) return sourceFileName.replace(/\.pdf$/i, "") || "SAT Practice";
  const first = questions[0];
  const tests = new Set(questions.map((q) => q.test).filter(Boolean));
  const domains = new Set(questions.map((q) => q.domain).filter(Boolean));
  const difficulties = new Set(questions.map((q) => q.difficulty).filter(Boolean));
  const parts = [];
  if (tests.size === 1) parts.push(first.test.replace("Reading and Writing", "Reading & Writing"));
  if (domains.size === 1) parts.push(first.domain);
  if (difficulties.size === 1) parts.push(first.difficulty);
  return parts.filter(Boolean).join(" — ") || sourceFileName.replace(/\.pdf$/i, "") || "SAT Practice";
}

const SATParser = {
  cleanInline,
  normalizeExtractedText,
  textItemsToLines,
  validateQuestion,
  parseQuestionText,
  parseSatPages,
  suggestDeckName,
};

if (typeof window !== "undefined") window.SATParser = SATParser;
if (typeof module !== "undefined" && module.exports) module.exports = SATParser;
