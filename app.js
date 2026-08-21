/* global pdfjsLib, SATParser */

(() => {
  "use strict";

  const DB_NAME = "sat-practice-local";
  const STORE_NAME = "decks";
  const DB_VERSION = 1;
  const ANSWER_KEYS = { "1": "A", "2": "B", "3": "C", "4": "D", a: "A", b: "B", c: "C", d: "D" };
  const THEORY_GUIDES = [
    {
      pattern: /form, structure|sentence structure|subject.?verb|pronoun|modifier|agreement|verb tense|parallel/,
      title: "Sentence structure and grammar",
      concepts: [
        "Identify the subject, main verb, and complete clause before judging punctuation or wording.",
        "Make modifiers point clearly to the word they describe, and keep pronouns, verbs, and comparisons logically aligned.",
        "Prefer the choice that creates a complete, concise sentence without changing the intended meaning.",
      ],
      practice: "Label each clause and its subject–verb pair before comparing the answer choices.",
    },
    {
      pattern: /boundar|punctuation|comma|semicolon|colon|dash/,
      title: "Clause boundaries and punctuation",
      concepts: [
        "An independent clause can stand alone; a dependent clause cannot.",
        "Use a period or semicolon between two independent clauses. A comma alone cannot join them.",
        "Use colons and dashes only after a complete clause when introducing an explanation, example, or list.",
      ],
      practice: "Cover the punctuation choices, classify the clauses on both sides, and then choose the legal boundary.",
    },
    {
      pattern: /transition/,
      title: "Logical transitions",
      concepts: [
        "Determine the relationship between the ideas before looking at the transition choices.",
        "Common relationships include continuation, contrast, cause and effect, and example or emphasis.",
        "Choose by logical function, not by which transition merely sounds natural.",
      ],
      practice: "Write your own simple connector—such as ‘but,’ ‘therefore,’ or ‘for example’—before checking the choices.",
    },
    {
      pattern: /rhetorical synthesis|synthesis|student wants/,
      title: "Rhetorical synthesis",
      concepts: [
        "Treat the stated writing goal as the rule for deciding which notes matter.",
        "Include only facts that directly accomplish the goal; accurate but irrelevant facts are distractions.",
        "Check that comparisons and claims preserve the notes precisely without adding assumptions.",
      ],
      practice: "Underline the task verb and audience, then select only the notes that directly serve both.",
    },
    {
      pattern: /words? in context|vocabulary|connotation/,
      title: "Words in context",
      concepts: [
        "Use the sentence’s logic and tone to predict a meaning before considering the choices.",
        "Test the ordinary meaning of each choice in the sentence; rare dictionary meanings are usually traps.",
        "Match both denotation and connotation, especially whether the surrounding tone is positive, neutral, or negative.",
      ],
      practice: "Replace the blank with your own simple word first, then choose the closest match.",
    },
    {
      pattern: /text structure|purpose|function of|overall structure/,
      title: "Text structure and purpose",
      concepts: [
        "Summarize what each sentence or paragraph does, not just what it says.",
        "Distinguish introducing, supporting, contrasting, qualifying, and concluding roles.",
        "Purpose answers should describe both the author’s action and its role in the passage.",
      ],
      practice: "Annotate each section with a short function label such as ‘claim,’ ‘example,’ or ‘counterpoint.’",
    },
    {
      pattern: /central idea|main idea|detail/,
      title: "Central ideas and supporting details",
      concepts: [
        "The central idea must cover the passage as a whole rather than one vivid detail.",
        "A correct detail answer should be stated or directly paraphrased in the text.",
        "Reject choices that are true in general but unsupported, too narrow, or too broad.",
      ],
      practice: "State the passage’s subject and the author’s main point about it in one sentence.",
    },
    {
      pattern: /inference|infer/,
      title: "Text-based inference",
      concepts: [
        "An inference must be supported by specific information even when it is not stated word for word.",
        "Prefer the smallest conclusion the evidence guarantees; avoid plausible but speculative extensions.",
        "Check every part of an answer choice, since one unsupported word makes the whole choice wrong.",
      ],
      practice: "Finish the sentence ‘Because the text says ___, it follows that ___.’",
    },
    {
      pattern: /command of evidence|evidence|quantitative|graph|table/,
      title: "Evidence and data",
      concepts: [
        "Identify the exact claim that the evidence must strengthen, weaken, or illustrate.",
        "For tables and graphs, read axis labels, units, groups, and direction before interpreting values.",
        "The best evidence proves the claim directly rather than merely discussing the same topic.",
      ],
      practice: "Translate the claim into a prediction about what the strongest quotation or data point must show.",
    },
    {
      pattern: /cross-text|paired text|two texts/,
      title: "Cross-text connections",
      concepts: [
        "State each author’s central claim separately before comparing them.",
        "Decide whether the authors agree, disagree, qualify one another, or focus on different aspects.",
        "Do not attribute an idea from one text to the other without direct support.",
      ],
      practice: "Write ‘Text 1 says…’ and ‘Text 2 says…,’ then describe the relationship in one precise verb.",
    },
    {
      pattern: /linear|system of equation|equation in one|inequalit/,
      title: "Linear equations and systems",
      concepts: [
        "Keep equations balanced by performing the same operation on both sides.",
        "Interpret slope as a rate of change and the intercept as the value when the input is zero.",
        "For systems, a solution must satisfy every equation; use substitution or elimination deliberately.",
      ],
      practice: "Define variables and units first, then verify the solution in the original equation or context.",
    },
    {
      pattern: /quadratic|nonlinear|function|exponential|polynomial/,
      title: "Functions and nonlinear relationships",
      concepts: [
        "Connect equivalent forms to useful features such as roots, intercepts, vertex, and growth factor.",
        "Treat function notation as input and output: evaluate by substituting the input everywhere it appears.",
        "Use the context and units to reject algebraic solutions that are not meaningful.",
      ],
      practice: "Name the feature the question asks for, then choose the algebraic form that exposes that feature.",
    },
    {
      pattern: /ratio|rate|proportion|percent|unit conversion/,
      title: "Ratios, rates, and percentages",
      concepts: [
        "Keep units attached to quantities and convert before combining unlike units.",
        "A percent change is change divided by the original value, not the final value.",
        "Use proportional relationships only when the ratio truly remains constant.",
      ],
      practice: "Write the units in every ratio and estimate the expected size of the answer before calculating.",
    },
    {
      pattern: /data|statistics|probability|scatterplot|sample|mean|median/,
      title: "Data analysis and probability",
      concepts: [
        "Match the statistic to the question: center, spread, association, or probability.",
        "Separate correlation from causation and samples from the populations they represent.",
        "Probability is favorable outcomes divided by all possible outcomes when outcomes are equally likely.",
      ],
      practice: "Describe the data in words—including population, variable, and units—before using a formula.",
    },
    {
      pattern: /geometry|triangle|circle|angle|volume|area|trigonometry/,
      title: "Geometry and trigonometry",
      concepts: [
        "Draw and label the figure from the given information instead of relying on its apparent scale.",
        "Track whether a formula uses a radius, diameter, height, area, or volume and keep units consistent.",
        "Use similarity, the Pythagorean theorem, and right-triangle ratios only after identifying corresponding sides.",
      ],
      practice: "Mark every known value and the requested quantity, then choose one relationship that connects them directly.",
    },
  ];
  const appMain = document.querySelector("#app-main");
  const headerCenter = document.querySelector("#header-center");
  const headerActions = document.querySelector("#header-actions");
  const importDialog = document.querySelector("#import-dialog");
  const importContent = document.querySelector("#import-content");
  const renameDialog = document.querySelector("#rename-dialog");
  const renameInput = document.querySelector("#rename-input");
  const toastRegion = document.querySelector("#toast-region");

  const state = {
    decks: [],
    currentDeckId: null,
    sequence: [],
    sequenceLabel: "",
    quizIndex: 0,
    preview: null,
    renameId: null,
  };

  function escapeHtml(value = "") {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
    })[character]);
  }

  function uid() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function toast(message) {
    const element = document.createElement("div");
    element.className = "toast";
    element.textContent = message;
    toastRegion.append(element);
    setTimeout(() => element.remove(), 3200);
  }

  class DeckStorage {
    constructor() {
      this.dbPromise = this.open();
    }

    open() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    async transaction(mode, operation) {
      const db = await this.dbPromise;
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }

    all() { return this.transaction("readonly", (store) => store.getAll()); }
    put(deck) { return this.transaction("readwrite", (store) => store.put(deck)); }
    delete(id) { return this.transaction("readwrite", (store) => store.delete(id)); }
  }

  const storage = new DeckStorage();

  function currentDeck() {
    return state.decks.find((deck) => deck.id === state.currentDeckId);
  }

  function currentQuestion() {
    const deck = currentDeck();
    const id = state.sequence[state.quizIndex];
    return deck?.questions.find((question) => question.questionId === id);
  }

  function deckStats(deck) {
    const answered = deck.questions.filter((question) => question.answered);
    const correct = answered.filter((question) => question.correct).length;
    return {
      answered: answered.length,
      correct,
      accuracy: answered.length ? Math.round((correct / answered.length) * 100) : null,
      percent: deck.questions.length ? (answered.length / deck.questions.length) * 100 : 0,
    };
  }

  async function saveDeck(deck) {
    deck.updatedAt = new Date().toISOString();
    await storage.put(deck);
  }

  function setHeader(center = "", actions = "") {
    headerCenter.textContent = center;
    headerActions.innerHTML = actions;
  }

  function renderDecks() {
    state.currentDeckId = null;
    state.sequence = [];
    setHeader();
    const sorted = [...state.decks].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    appMain.innerHTML = `
      <section class="page" aria-labelledby="decks-title">
        <div class="page-heading">
          <div>
            <p class="eyebrow">Your library</p>
            <h1 id="decks-title">My SAT Decks</h1>
            <p>${sorted.length ? `${sorted.length} saved ${sorted.length === 1 ? "deck" : "decks"}` : "Build your first practice deck from a Question Bank export."}</p>
          </div>
          <button class="button primary" data-action="open-import">＋ Import Question Bank PDF</button>
        </div>
        ${sorted.length ? `<div class="deck-grid">${sorted.map(deckCard).join("")}</div>` : emptyState()}
      </section>`;
    appMain.focus({ preventScroll: true });
  }

  function deckCard(deck) {
    const stats = deckStats(deck);
    const tests = unique(deck.questions.map((question) => question.test));
    const domains = unique(deck.questions.map((question) => question.domain));
    const metadata = [...tests.slice(0, 1), ...domains.slice(0, 1)];
    return `
      <article class="deck-card" data-deck-id="${escapeHtml(deck.id)}">
        <div class="deck-card-top">
          <h2>${escapeHtml(deck.name)}</h2>
          <details class="menu">
            <summary aria-label="Options for ${escapeHtml(deck.name)}">•••</summary>
            <div class="menu-popover">
              <button data-action="rename">Rename</button>
              <button data-action="reset">Reset progress</button>
              <button data-action="delete">Delete</button>
            </div>
          </details>
        </div>
        <div class="deck-meta">${metadata.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>
        <div class="deck-stats">
          <div><span class="stat-label">Progress</span><span class="stat-value">${stats.answered} / ${deck.questions.length}</span></div>
          <div><span class="stat-label">Accuracy</span><span class="stat-value">${stats.accuracy === null ? "—" : `${stats.accuracy}%`}</span></div>
        </div>
        <div class="mini-progress" role="progressbar" aria-label="Deck progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(stats.percent)}"><span style="width:${stats.percent}%"></span></div>
        <button class="button primary" data-action="continue">${stats.answered === deck.questions.length && deck.questions.length ? "View results" : stats.answered ? "Continue" : "Start practice"}</button>
      </article>`;
  }

  function emptyState() {
    return `
      <div class="empty-state">
        <div>
          <div class="empty-icon" aria-hidden="true">＋</div>
          <h2>Turn a PDF into practice</h2>
          <p>Import a text-based SAT Educator Question Bank PDF. Questions, answers, explanations, and progress stay on this device.</p>
          <button class="button primary" data-action="open-import">Import your first PDF</button>
        </div>
      </div>`;
  }

  function openImport() {
    state.preview = null;
    renderImportPicker();
    importDialog.showModal();
  }

  function renderImportPicker(error = "") {
    importContent.innerHTML = `
      ${error ? `<div class="error-box" role="alert">${escapeHtml(error)}</div>` : ""}
      <label class="drop-zone" id="drop-zone" for="pdf-input">
        <div>
          <div class="empty-icon" aria-hidden="true">⇧</div>
          <h3>Choose a Question Bank PDF</h3>
          <p>Drop a PDF here, or click to browse</p>
          <span class="button secondary">Choose PDF</span>
          <input class="file-input" id="pdf-input" type="file" accept="application/pdf,.pdf">
        </div>
      </label>
      <p class="privacy-note"><span aria-hidden="true">🔒</span><span>Your PDFs and quiz data stay in this browser. Nothing is uploaded to a server.</span></p>`;
    const input = document.querySelector("#pdf-input");
    const dropZone = document.querySelector("#drop-zone");
    input.addEventListener("change", () => input.files[0] && importPdf(input.files[0]));
    ["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove("dragging");
    }));
    dropZone.addEventListener("drop", (event) => {
      const file = event.dataTransfer.files[0];
      if (file) importPdf(file);
    });
  }

  async function importPdf(file) {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      renderImportPicker("Please choose a PDF file.");
      return;
    }
    importContent.innerHTML = `<div class="import-loading" role="status"><div class="spinner"></div><h3>Reading ${escapeHtml(file.name)}</h3><p id="import-progress">Preparing your PDF…</p></div>`;
    try {
      if (!globalThis.pdfjsLib) throw new Error("The bundled PDF reader could not be loaded.");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdf.worker.min.js";
      const bytes = new Uint8Array(await file.arrayBuffer());
      const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
      const pageTexts = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const progress = document.querySelector("#import-progress");
        if (progress) progress.textContent = `Extracting page ${pageNumber} of ${pdf.numPages}…`;
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent({ includeMarkedContent: false });
        pageTexts.push(SATParser.textItemsToLines(content.items));
      }
      const parsed = SATParser.parseSatPages(pageTexts);
      if (!parsed.questions.length) {
        state.preview = { file, ...parsed };
        renderImportFailure("No complete SAT questions were detected. Open diagnostics below to inspect the extracted text.");
        return;
      }
      state.preview = { file, ...parsed };
      renderImportPreview();
    } catch (error) {
      console.error(error);
      renderImportPicker(`We couldn't read this PDF. ${error.message || "The file may be damaged or protected."}`);
    }
  }

  function renderImportFailure(message) {
    importContent.innerHTML = `
      <div class="error-box" role="alert">${escapeHtml(message)}</div>
      ${diagnosticsHtml(state.preview.diagnostics)}
      <div class="modal-actions"><button class="button secondary" id="try-another" type="button">Choose another PDF</button></div>`;
    document.querySelector("#try-another").addEventListener("click", () => renderImportPicker());
  }

  function renderImportPreview() {
    const { questions, diagnostics, file } = state.preview;
    const failedPages = diagnostics.filter((item) => !item.success);
    const domains = unique(questions.map((question) => question.domain));
    const skills = unique(questions.map((question) => question.skill));
    const difficulties = unique(questions.map((question) => question.difficulty));
    const suggested = SATParser.suggestDeckName(questions, file.name);
    importContent.innerHTML = `
      <div class="import-summary">✓ ${questions.length} ${questions.length === 1 ? "question" : "questions"} detected</div>
      ${failedPages.length ? `<div class="import-warning">${failedPages.length} ${failedPages.length === 1 ? "page could" : "pages could"} not be parsed and will be skipped.</div>` : ""}
      <label class="field-label" for="deck-name-input">Deck name</label>
      <input id="deck-name-input" class="text-input" maxlength="100" value="${escapeHtml(suggested)}" required>
      <div class="preview-grid">
        <div class="preview-item"><span>Question IDs</span><strong>${escapeHtml(questions.map((q) => q.questionId).join(", "))}</strong></div>
        <div class="preview-item"><span>Domain</span><strong>${escapeHtml(domains.join(", ") || "Mixed")}</strong></div>
        <div class="preview-item"><span>Skill</span><strong>${escapeHtml(skills.join(", ") || "Mixed")}</strong></div>
        <div class="preview-item"><span>Difficulty</span><strong>${escapeHtml(difficulties.join(", ") || "Mixed")}</strong></div>
      </div>
      ${diagnosticsHtml(diagnostics)}
      <div class="modal-actions">
        <button class="button secondary" id="try-another" type="button">Choose another</button>
        <button class="button primary" id="save-import" type="button">Save & practice</button>
      </div>`;
    document.querySelector("#try-another").addEventListener("click", () => renderImportPicker());
    document.querySelector("#save-import").addEventListener("click", saveImport);
    const nameInput = document.querySelector("#deck-name-input");
    nameInput.focus();
    nameInput.select();
  }

  function diagnosticsHtml(diagnostics) {
    return `
      <details class="diagnostics">
        <summary>Import diagnostics</summary>
        ${diagnostics.map((item) => `
          <div class="diagnostic-row">
            <strong>Page ${item.pageNumber}</strong> ·
            <span class="diagnostic-status ${item.success ? "ok" : "fail"}">${item.success ? "✓ Parsed" : "✕ Not parsed"}</span>
            ${item.questionIds.length ? ` · ID ${escapeHtml(item.questionIds.join(", "))}` : ""}
            ${item.errors.length ? `<p>${escapeHtml(item.errors.join("; "))}</p>` : ""}
            ${!item.success ? `<details><summary>Show extracted text</summary><pre class="diagnostic-text">${escapeHtml(item.extractedText)}</pre></details>` : ""}
          </div>`).join("")}
      </details>`;
  }

  async function saveImport() {
    const input = document.querySelector("#deck-name-input");
    const name = input.value.trim();
    if (!name) {
      input.focus();
      return;
    }
    const deck = {
      id: uid(),
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceFileName: state.preview.file.name,
      questions: state.preview.questions,
    };
    await saveDeck(deck);
    state.decks.push(deck);
    importDialog.close();
    startDeck(deck.id);
  }

  function startDeck(deckId, options = {}) {
    const deck = state.decks.find((item) => item.id === deckId);
    if (!deck) return;
    state.currentDeckId = deckId;
    if (options.sequence) {
      state.sequence = options.sequence;
      state.sequenceLabel = options.label || "Review";
      state.quizIndex = options.startIndex || 0;
    } else {
      state.sequence = deck.questions.map((question) => question.questionId);
      state.sequenceLabel = "";
      const firstUnanswered = deck.questions.findIndex((question) => !question.answered);
      state.quizIndex = firstUnanswered >= 0 ? firstUnanswered : 0;
    }
    if (deck.questions.length && deck.questions.every((question) => question.answered) && !options.forceQuiz) renderResults();
    else renderQuiz();
  }

  function renderQuiz() {
    const deck = currentDeck();
    const question = currentQuestion();
    if (!deck || !question) return renderDecks();
    const position = state.quizIndex + 1;
    setHeader(deck.name, `<span class="question-count">${escapeHtml(state.sequenceLabel ? `${state.sequenceLabel} · ` : "")}Question ${position} of ${state.sequence.length}</span><button class="button secondary text-button" data-header-action="decks">Decks</button>`);
    const answerEntries = Object.entries(question.answers);
    appMain.innerHTML = `
      <section class="quiz-page" aria-labelledby="question-prompt">
        <div class="question-meta">
          ${[question.test, question.domain, question.skill, question.difficulty].filter(Boolean).map((value) => `<span class="pill">${escapeHtml(value)}</span>`).join("")}
        </div>
        <article class="question-card">
          ${question.passage ? `<p class="passage">${escapeHtml(question.passage)}</p>` : ""}
          <p class="prompt" id="question-prompt">${escapeHtml(question.prompt || question.passage)}</p>
        </article>
        <div class="answers" role="group" aria-label="Answer choices">
          ${answerEntries.map(([letter, answer]) => answerButton(question, letter, answer)).join("")}
        </div>
        ${question.answered || question.lastIncorrectAnswer ? feedbackHtml(question) : ""}
      </section>
      <footer class="quiz-footer">
        <div class="quiz-footer-inner">
          <button class="button secondary" data-quiz-action="previous" ${position === 1 ? "disabled" : ""}>← Previous</button>
          <div class="footer-progress">
            <span>${position} of ${state.sequence.length}</span>
            <div class="progress-track" role="progressbar" aria-label="Question position" aria-valuemin="1" aria-valuemax="${state.sequence.length}" aria-valuenow="${position}"><span class="progress-fill" style="width:${position / state.sequence.length * 100}%"></span></div>
          </div>
          <div class="footer-actions">
            ${question.answered
              ? `<button class="button primary" data-quiz-action="next">${position === state.sequence.length ? "See results" : "Next question"} →</button>`
              : `<button class="button primary" data-quiz-action="check" ${question.selectedAnswer ? "" : "disabled"}>Check answer</button>`}
          </div>
        </div>
      </footer>`;
    appMain.focus({ preventScroll: true });
  }

  function answerButton(question, letter, text) {
    const selected = question.selectedAnswer === letter;
    const correct = question.answered && question.correctAnswer === letter;
    const incorrect = !question.answered && question.lastIncorrectAnswer === letter;
    const classes = ["answer", selected && !question.answered ? "selected" : "", correct ? "correct" : "", incorrect ? "incorrect" : ""].filter(Boolean).join(" ");
    let result = "";
    if (correct) result = "✓ Correct answer";
    else if (incorrect) result = "✕ Try again";
    return `<button class="${classes}" data-answer="${letter}" ${question.answered ? "disabled" : ""} aria-pressed="${selected}">
      <span class="answer-letter">${letter}</span><span class="answer-text">${escapeHtml(text)}</span>${result ? `<span class="answer-result">${result}</span>` : ""}
    </button>`;
  }

  function feedbackHtml(question) {
    if (!question.answered) {
      return `<section class="feedback incorrect" aria-live="polite">
        <h2 class="feedback-title">✕ Not quite</h2>
        <p>Try this question again. The correct answer and explanation will stay hidden until you get it right.</p>
      </section>`;
    }
    return `<section class="feedback ${question.correct ? "" : "incorrect"}" aria-live="polite">
      <h2 class="feedback-title">✓ Correct</h2>
      <h3>Explanation</h3>
      <p>${escapeHtml(question.rationale || "No rationale was available in the extracted PDF text.")}</p>
    </section>`;
  }

  function selectAnswer(letter) {
    const question = currentQuestion();
    if (!question || question.answered || !question.answers[letter]) return;
    question.selectedAnswer = letter;
    question.lastIncorrectAnswer = null;
    renderQuiz();
    document.querySelector(`[data-answer="${letter}"]`)?.focus();
  }

  async function checkAnswer() {
    const deck = currentDeck();
    const question = currentQuestion();
    if (!question?.selectedAnswer || question.answered) return;
    if (question.selectedAnswer !== question.correctAnswer) {
      question.incorrectAttempts = (question.incorrectAttempts || 0) + 1;
      question.lastIncorrectAnswer = question.selectedAnswer;
      question.selectedAnswer = null;
      question.answered = false;
      question.correct = null;
    } else {
      question.answered = true;
      // A correct retry completes the question, but an earlier miss in the
      // same quiz still counts against the score. "Retry incorrect" resets
      // incorrectAttempts so a clean post-quiz repeat can clear the mistake.
      question.correct = (question.incorrectAttempts || 0) === 0;
      question.lastIncorrectAnswer = null;
    }
    await saveDeck(deck);
    renderQuiz();
    document.querySelector(".feedback")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function nextQuestion() {
    const question = currentQuestion();
    if (!question?.answered) return;
    if (state.quizIndex < state.sequence.length - 1) {
      state.quizIndex += 1;
      renderQuiz();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      renderResults();
    }
  }

  function previousQuestion() {
    if (state.quizIndex > 0) {
      state.quizIndex -= 1;
      renderQuiz();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function breakdown(questions, key) {
    const groups = new Map();
    questions.forEach((question) => {
      const label = question[key] || "Unspecified";
      const value = groups.get(label) || { correct: 0, total: 0 };
      value.total += 1;
      if (question.correct) value.correct += 1;
      groups.set(label, value);
    });
    return [...groups.entries()];
  }

  function theoryGuideFor(question) {
    const metadata = `${question.skill || ""} ${question.domain || ""}`.toLowerCase();
    const matched = THEORY_GUIDES.find((guide) => guide.pattern.test(metadata));
    if (matched) return matched;
    const skill = question.skill || question.domain || "this SAT skill";
    return {
      title: `${skill} fundamentals`,
      concepts: [
        `Review the definition and core rule for ${skill}.`,
        "Use the official rationale to identify the exact clue or rule that makes the correct choice work.",
        "For each rejected choice, explain the specific rule, evidence, or calculation it violates.",
      ],
      practice: "Redo a fresh example slowly, state the rule before solving, and check each step against that rule.",
    };
  }

  function weakSpotGroups(questions) {
    const groups = new Map();
    questions.forEach((question) => {
      const skill = question.skill || "Unspecified skill";
      const domain = question.domain || "SAT practice";
      const key = `${domain}\u0000${skill}`;
      if (!groups.has(key)) groups.set(key, { skill, domain, questions: [], difficulties: new Set(), guide: theoryGuideFor(question) });
      const group = groups.get(key);
      group.questions.push(question);
      if (question.difficulty) group.difficulties.add(question.difficulty);
    });
    return [...groups.values()].sort((a, b) => {
      const attemptsA = a.questions.reduce((sum, question) => sum + (question.incorrectAttempts || 0), 0);
      const attemptsB = b.questions.reduce((sum, question) => sum + (question.incorrectAttempts || 0), 0);
      return attemptsB - attemptsA;
    });
  }

  function weakSpotsHtml(mistakes) {
    if (!mistakes.length) return "";
    const groups = weakSpotGroups(mistakes);
    const totalAttempts = mistakes.reduce((sum, question) => sum + (question.incorrectAttempts || 0), 0);
    return `
      <section class="weak-spots" id="weak-spots" tabindex="-1" aria-labelledby="weak-spots-title">
        <div class="weak-spots-heading">
          <div>
            <p class="eyebrow">Personal study plan</p>
            <h2 id="weak-spots-title">Weak spots to relearn</h2>
            <p>Generated locally from ${totalAttempts} missed ${totalAttempts === 1 ? "attempt" : "attempts"} across ${mistakes.length} ${mistakes.length === 1 ? "question" : "questions"}.</p>
          </div>
          <span class="weak-count">${groups.length} ${groups.length === 1 ? "topic" : "topics"}</span>
        </div>
        <div class="weak-spot-list">${groups.map(weakSpotCard).join("")}</div>
      </section>`;
  }

  function weakSpotCard(group) {
    const attempts = group.questions.reduce((sum, question) => sum + (question.incorrectAttempts || 0), 0);
    return `
      <article class="weak-spot-card">
        <div class="weak-spot-top">
          <div>
            <div class="weak-spot-meta">
              <span class="pill">${escapeHtml(group.domain)}</span>
              ${[...group.difficulties].map((difficulty) => `<span class="pill">${escapeHtml(difficulty)}</span>`).join("")}
            </div>
            <h3>${escapeHtml(group.skill)}</h3>
            <p class="theory-title">Theory refresh: ${escapeHtml(group.guide.title)}</p>
          </div>
          <div class="attempt-badge"><strong>${attempts}</strong><span>missed ${attempts === 1 ? "attempt" : "attempts"}</span></div>
        </div>
        <ul class="theory-list">${group.guide.concepts.map((concept) => `<li>${escapeHtml(concept)}</li>`).join("")}</ul>
        <div class="practice-tip"><strong>How to practice</strong><span>${escapeHtml(group.guide.practice)}</span></div>
        <details class="rationale-review">
          <summary>Review ${group.questions.length === 1 ? "the missed question" : `${group.questions.length} missed questions`} and official explanations</summary>
          <div class="rationale-list">
            ${group.questions.map((question) => `
              <article>
                <strong>Question ${escapeHtml(question.questionId)}</strong>
                <span>${question.incorrectAttempts || 1} missed ${(question.incorrectAttempts || 1) === 1 ? "attempt" : "attempts"}</span>
                <p>${escapeHtml(question.rationale || "No rationale was available in the extracted PDF text.")}</p>
              </article>`).join("")}
          </div>
        </details>
      </article>`;
  }

  function renderResults() {
    const deck = currentDeck();
    if (!deck) return renderDecks();
    const answered = deck.questions.filter((question) => question.answered);
    const correct = answered.filter((question) => question.correct).length;
    const mistakes = deck.questions.filter((question) => (question.incorrectAttempts || 0) > 0);
    const percent = answered.length ? Math.round(correct / answered.length * 100) : 0;
    setHeader(deck.name, `<button class="button secondary text-button" data-header-action="decks">Decks</button>`);
    appMain.innerHTML = `
      <section class="results-page" aria-labelledby="results-title">
        <div class="results-hero">
          <p class="eyebrow">${answered.length === deck.questions.length ? "Deck complete" : "Progress so far"}</p>
          <h1 id="results-title">${escapeHtml(deck.name)}</h1>
          <div class="score">${percent}%</div>
          <div class="score-detail">${correct} / ${answered.length} completed without a mistake</div>
          <div class="results-actions">
            <button class="button primary" data-result-action="mistakes" ${mistakes.length ? "" : "disabled"}>Review mistakes</button>
            <button class="button secondary" data-result-action="weak-spots" ${mistakes.length ? "" : "disabled"}>Study weak spots</button>
            <button class="button secondary" data-result-action="all">Review all questions</button>
            <button class="button secondary" data-result-action="retry" ${mistakes.length ? "" : "disabled"}>Retry incorrect</button>
            <button class="button secondary" data-result-action="reset">Reset deck</button>
            <button class="button secondary" data-result-action="decks">Back to decks</button>
          </div>
        </div>
        ${weakSpotsHtml(mistakes)}
        <div class="breakdowns">
          ${breakdownCard("By skill", breakdown(answered, "skill"))}
          ${breakdownCard("By difficulty", breakdown(answered, "difficulty"))}
        </div>
      </section>`;
    appMain.focus({ preventScroll: true });
  }

  function breakdownCard(title, rows) {
    return `<section class="breakdown-card"><h2>${title}</h2>${rows.length ? rows.map(([label, value]) => `<div class="breakdown-row"><span>${escapeHtml(label)}</span><strong>${value.correct} / ${value.total}</strong></div>`).join("") : `<p class="score-detail">No answered questions yet.</p>`}</section>`;
  }

  async function resetDeck(deck, ask = true) {
    if (ask && !confirm(`Reset all progress for “${deck.name}”?`)) return false;
    deck.questions.forEach((question) => Object.assign(question, { selectedAnswer: null, answered: false, correct: null, incorrectAttempts: 0, lastIncorrectAnswer: null }));
    await saveDeck(deck);
    toast("Deck progress reset");
    return true;
  }

  async function retryMistakes() {
    const deck = currentDeck();
    const ids = deck.questions.filter((question) => (question.incorrectAttempts || 0) > 0).map((question) => question.questionId);
    deck.questions.filter((question) => ids.includes(question.questionId)).forEach((question) => Object.assign(question, { selectedAnswer: null, answered: false, correct: null, incorrectAttempts: 0, lastIncorrectAnswer: null }));
    await saveDeck(deck);
    startDeck(deck.id, { sequence: ids, label: "Retry incorrect", forceQuiz: true });
  }

  async function handleDeckAction(action, deck) {
    if (action === "continue") return startDeck(deck.id);
    if (action === "rename") {
      state.renameId = deck.id;
      renameInput.value = deck.name;
      renameDialog.showModal();
      setTimeout(() => { renameInput.focus(); renameInput.select(); });
    }
    if (action === "reset" && await resetDeck(deck)) renderDecks();
    if (action === "delete" && confirm(`Delete “${deck.name}”? This cannot be undone.`)) {
      await storage.delete(deck.id);
      state.decks = state.decks.filter((item) => item.id !== deck.id);
      toast("Deck deleted");
      renderDecks();
    }
  }

  appMain.addEventListener("click", async (event) => {
    const actionElement = event.target.closest("[data-action]");
    if (actionElement) {
      if (actionElement.dataset.action === "open-import") return openImport();
      const card = actionElement.closest("[data-deck-id]");
      const deck = state.decks.find((item) => item.id === card?.dataset.deckId);
      if (deck) return handleDeckAction(actionElement.dataset.action, deck);
    }
    const answer = event.target.closest("[data-answer]");
    if (answer) return selectAnswer(answer.dataset.answer);
    const quizAction = event.target.closest("[data-quiz-action]")?.dataset.quizAction;
    if (quizAction === "check") return checkAnswer();
    if (quizAction === "next") return nextQuestion();
    if (quizAction === "previous") return previousQuestion();
    const resultAction = event.target.closest("[data-result-action]")?.dataset.resultAction;
    const deck = currentDeck();
    if (!resultAction || !deck) return;
    if (resultAction === "decks") return renderDecks();
    if (resultAction === "weak-spots") {
      const weakSpots = document.querySelector("#weak-spots");
      weakSpots?.scrollIntoView({ behavior: "smooth", block: "start" });
      weakSpots?.focus({ preventScroll: true });
      return;
    }
    if (resultAction === "all") return startDeck(deck.id, { sequence: deck.questions.map((q) => q.questionId), label: "Review all", forceQuiz: true });
    if (resultAction === "mistakes") return startDeck(deck.id, { sequence: deck.questions.filter((q) => (q.incorrectAttempts || 0) > 0).map((q) => q.questionId), label: "Review mistakes", forceQuiz: true });
    if (resultAction === "retry") return retryMistakes();
    if (resultAction === "reset" && await resetDeck(deck)) return startDeck(deck.id);
  });

  headerActions.addEventListener("click", (event) => {
    if (event.target.closest("[data-header-action='decks']")) renderDecks();
  });
  document.querySelector("#brand-button").addEventListener("click", renderDecks);

  renameDialog.addEventListener("close", async () => {
    if (renameDialog.returnValue !== "save") return;
    const deck = state.decks.find((item) => item.id === state.renameId);
    const name = renameInput.value.trim();
    if (!deck || !name) return;
    deck.name = name;
    await saveDeck(deck);
    toast("Deck renamed");
    renderDecks();
  });

  document.addEventListener("keydown", (event) => {
    if (importDialog.open || renameDialog.open || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
    const question = currentQuestion();
    if (!question) return;
    const key = event.key.toLowerCase();
    if (ANSWER_KEYS[key] && !question.answered) {
      event.preventDefault();
      selectAnswer(ANSWER_KEYS[key]);
    } else if (event.key === "Enter") {
      event.preventDefault();
      question.answered ? nextQuestion() : checkAnswer();
    } else if (event.key === "ArrowLeft") {
      previousQuestion();
    } else if (event.key === "ArrowRight" && question.answered) {
      nextQuestion();
    }
  });

  async function initialize() {
    try {
      state.decks = await storage.all();
      // Convert incorrect answers saved by the earlier one-attempt flow into
      // retryable questions without exposing their correct answers.
      const migrated = state.decks.filter((deck) => deck.questions.some((question) =>
        (question.answered && question.correct === false && !(question.incorrectAttempts > 0)) ||
        (question.answered && question.correct === true && question.incorrectAttempts > 0)
      ));
      migrated.forEach((deck) => deck.questions.forEach((question) => {
        if (question.answered && question.correct === false && !(question.incorrectAttempts > 0)) {
          question.incorrectAttempts = Math.max(1, question.incorrectAttempts || 0);
          question.lastIncorrectAnswer = question.selectedAnswer;
          question.selectedAnswer = null;
          question.answered = false;
          question.correct = null;
        } else if (question.answered && question.correct === true && question.incorrectAttempts > 0) {
          question.correct = false;
        }
      }));
      await Promise.all(migrated.map(saveDeck));
      renderDecks();
    } catch (error) {
      console.error(error);
      appMain.innerHTML = `<section class="page"><div class="error-box"><strong>Browser storage is unavailable.</strong><br>Please allow local site data for this page, then reload.</div></section>`;
    }
  }

  initialize();
})();
