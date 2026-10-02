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
    // Keep the meaningful space before a leading decimal ("or .667").
    .replace(/\s+([,;:!?]|\.(?!\d))/g, "$1")
    .replace(/([“‘(])\s+/g, "$1")
    .trim();
}

function normalizeExtractedText(text = "") {
  let result = text
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u200b-\u200d\ufeff]/g, "")
    .replace(/\ufb00/g, "ff")
    .replace(/\ufb01/g, "fi")
    .replace(/\ufb02/g, "fl")
    .replace(/\u2215/g, "/")
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
    if (start >= from && cleanInline(line).replace(/:$/, "").toLowerCase() === marker.toLowerCase()) {
      return { start, contentStart: Math.min(text.length, end + 1) };
    }
    offset = end + 1;
  }
  return null;
}

function regexLineRange(text, pattern, from = 0) {
  const lines = text.split("\n");
  let offset = 0;
  for (const line of lines) {
    const start = offset;
    const end = start + line.length;
    if (start >= from && pattern.test(cleanInline(line))) {
      return { start, contentStart: Math.min(text.length, end + 1) };
    }
    pattern.lastIndex = 0;
    offset = end + 1;
  }
  return null;
}

function metadataValue(header, label) {
  const lines = header.split("\n").map(cleanInline).filter(Boolean);
  const inline = lines.find((line) => new RegExp(`^${label}\\s*:\\s*.+$`, "i").test(line));
  if (inline) return cleanInline(inline.replace(new RegExp(`^${label}\\s*:\\s*`, "i"), ""));
  const index = lines.findIndex((line) => line.replace(/:$/, "").toLowerCase() === label.toLowerCase());
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
  const prepared = `\n${answerText.replace(/[ \t]+([A-D])[.)][ \t]+/g, "\n$1. ")}`;
  const starts = [...prepared.matchAll(/(?:^|\n)[ \t]*([A-D])(?:[.)]|(?=[ \t]*$))[ \t]*/gim)];
  const answers = {};
  starts.forEach((match, index) => {
    const start = match.index + match[0].length;
    const end = starts[index + 1]?.index ?? prepared.length;
    answers[match[1].toUpperCase()] = cleanMultiline(prepared.slice(start, end));
  });
  return answers;
}

function parseAcceptedAnswers(value = "") {
  const cleaned = cleanInline(value)
    .replace(/^(?:answer|answers)\s*(?:is|are)?\s*/i, "")
    .replace(/[{}]/g, "")
    .trim();
  if (!cleaned) return [];

  // Question Bank grid-ins commonly list alternatives with "or", commas,
  // or semicolons. A comma between thousands digits remains part of a value.
  return [...new Set(cleaned
    .split(/\s+(?:or|and)\s+|;|,(?!\d{3}\b)/i)
    .map((answer) => cleanInline(answer.replace(/^(?:and|or)\s+/i, "")))
    .filter(Boolean))];
}

function numericValue(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/[−–—]/g, "-")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return Number(normalized);
  const fraction = /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\/([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/.exec(normalized);
  if (fraction && Number(fraction[2]) !== 0) return Number(fraction[1]) / Number(fraction[2]);
  return null;
}

function isAcceptedResponse(response, acceptedAnswers = []) {
  const submitted = String(response ?? "").trim();
  if (!submitted) return false;
  return acceptedAnswers.some((accepted) => {
    const expected = String(accepted).trim();
    if (submitted.toLowerCase() === expected.toLowerCase()) return true;
    const submittedNumber = numericValue(submitted);
    const expectedNumber = numericValue(expected);
    return submittedNumber !== null && expectedNumber !== null && Math.abs(submittedNumber - expectedNumber) < 1e-9;
  });
}

function validateQuestion(question) {
  const errors = [];
  if (!question.questionId) errors.push("Question ID was not found");
  if (!question.passage && !question.prompt) errors.push("Question text was not found");
  if (question.responseType === "multiple-choice") {
    if (Object.keys(question.answers).length < 2) errors.push("Fewer than two answer choices were found");
    if (!/^[A-D]$/.test(question.correctAnswer)) errors.push("Correct answer was not found");
    if (question.correctAnswer && !Object.prototype.hasOwnProperty.call(question.answers, question.correctAnswer)) errors.push("Correct answer is missing from the parsed choices");
  } else if (!question.acceptedAnswers.length) {
    errors.push("Student-produced answer was not found");
  }
  return errors;
}

function parseQuestionText(rawText, pageNumber = 1) {
  const text = normalizeExtractedText(rawText);
  const idMatch = /Question ID\s*:\s*([A-Za-z0-9-]+)/i.exec(text);
  const escapedId = (idMatch?.[1] ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const explicitQuestionMarker = markerRange(text, "Question", idMatch?.index ?? 0);
  const idQuestionMarker = escapedId
    ? regexLineRange(text, new RegExp(`^ID\\s*:\\s*${escapedId}\\s*$`, "i"), (idMatch?.index ?? 0) + (idMatch?.[0]?.length ?? 0))
    : null;
  const questionMarker = explicitQuestionMarker || idQuestionMarker;
  const answerMarker = questionMarker ? markerRange(text, "Answer", questionMarker.contentStart) : null;
  const correctMatch = /Correct Answer\s*:\s*([^\n]+)/i.exec(text);
  const rationaleMarker = markerRange(text, "Rationale", correctMatch?.index ?? 0);

  const headerEnd = questionMarker?.start ?? text.length;
  const questionEnd = answerMarker?.start ?? correctMatch?.index ?? text.length;
  const answerEnd = correctMatch?.index ?? rationaleMarker?.start ?? text.length;
  const questionBody = questionMarker ? text.slice(questionMarker.contentStart, questionEnd) : "";
  const answerBody = answerMarker ? text.slice(answerMarker.contentStart, answerEnd) : "";
  const rationale = rationaleMarker ? cleanMultiline(text.slice(rationaleMarker.contentStart)) : "";
  const answers = parseAnswers(answerBody);
  const correctValue = cleanInline(correctMatch?.[1] ?? "");
  const choiceAnswer = /^[A-D]$/i.test(correctValue) && Object.prototype.hasOwnProperty.call(answers, correctValue.toUpperCase())
    ? correctValue.toUpperCase()
    : "";
  const responseType = Object.keys(answers).length >= 2 ? "multiple-choice" : "student-produced";
  const body = /^Math$/i.test(metadataValue(text.slice(0, headerEnd), "Test"))
    ? { passage: "", prompt: cleanMultiline(questionBody) }
    : splitQuestionBody(questionBody);

  const question = {
    questionId: idMatch?.[1] ?? "",
    assessment: metadataValue(text.slice(0, headerEnd), "Assessment"),
    test: metadataValue(text.slice(0, headerEnd), "Test"),
    domain: metadataValue(text.slice(0, headerEnd), "Domain"),
    skill: metadataValue(text.slice(0, headerEnd), "Skill"),
    difficulty: metadataValue(text.slice(0, headerEnd), "Difficulty"),
    passage: body.passage,
    prompt: body.prompt,
    answers,
    responseType,
    correctAnswer: responseType === "multiple-choice" ? choiceAnswer : correctValue,
    acceptedAnswers: responseType === "student-produced" ? parseAcceptedAnswers(correctValue) : [],
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

/**
 * Parse the PDF as one document. Educator Question Bank exports often put the
 * prompt on one page and its answer/rationale on the next, so page-at-a-time
 * validation incorrectly rejects both halves.
 */
function parseSatPages(pageTexts) {
  const questions = [];
  const normalizedPages = pageTexts.map(normalizeExtractedText);
  const pageStarts = [];
  let documentText = "";
  normalizedPages.forEach((page, index) => {
    if (index) documentText += "\n";
    pageStarts[index] = documentText.length;
    documentText += page;
  });

  const pageForOffset = (offset) => {
    let pageIndex = pageStarts.length - 1;
    while (pageIndex > 0 && pageStarts[pageIndex] > offset) pageIndex -= 1;
    return pageIndex + 1;
  };
  const diagnostics = normalizedPages.map((extractedText, index) => ({
    pageNumber: index + 1,
    success: false,
    questionIds: [],
    errors: [],
    extractedText,
  }));

  const idStarts = [...documentText.matchAll(/Question ID\s*:/gi)].map((match) => match.index);
  if (!idStarts.length && normalizedPages.length) {
    const result = parseQuestionText(documentText, 1);
    diagnostics[0].questionIds = result.question.questionId ? [result.question.questionId] : [];
    diagnostics[0].errors = result.errors;
    if (!result.errors.length) {
      questions.push(result.question);
      diagnostics[0].success = true;
    }
    return { questions, diagnostics };
  }

  idStarts.forEach((start, index) => {
    const end = idStarts[index + 1] ?? documentText.length;
    const startPage = pageForOffset(start);
    const endPage = pageForOffset(Math.max(start, end - 1));
    const result = parseQuestionText(documentText.slice(start, end), startPage);
    result.question.sourceEndPage = endPage;
    const coveredPages = Array.from({ length: endPage - startPage + 1 }, (_, pageIndex) => startPage + pageIndex);
    coveredPages.forEach((pageNumber) => {
      const diagnostic = diagnostics[pageNumber - 1];
      if (result.question.questionId && !diagnostic.questionIds.includes(result.question.questionId)) {
        diagnostic.questionIds.push(result.question.questionId);
      }
      if (!result.errors.length) diagnostic.success = true;
      else diagnostic.errors.push(...result.errors);
    });
    if (!result.errors.length) questions.push(result.question);
  });

  diagnostics.forEach((diagnostic) => {
    diagnostic.errors = [...new Set(diagnostic.errors)];
    if (!diagnostic.success && !diagnostic.errors.length) diagnostic.errors.push("No complete question text was found on this page");
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
  parseAcceptedAnswers,
  isAcceptedResponse,
  suggestDeckName,
};

if (typeof window !== "undefined") window.SATParser = SATParser;
if (typeof module !== "undefined" && module.exports) module.exports = SATParser;
