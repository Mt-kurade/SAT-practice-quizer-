/* global pdfjsLib, SATParser */

(() => {
  "use strict";

  const DB_NAME = "sat-practice-local";
  const STORE_NAME = "decks";
  const DB_VERSION = 1;
  const ANSWER_KEYS = { "1": "A", "2": "B", "3": "C", "4": "D", a: "A", b: "B", c: "C", d: "D" };
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
            <button class="button secondary" data-result-action="all">Review all questions</button>
            <button class="button secondary" data-result-action="retry" ${mistakes.length ? "" : "disabled"}>Retry incorrect</button>
            <button class="button secondary" data-result-action="reset">Reset deck</button>
            <button class="button secondary" data-result-action="decks">Back to decks</button>
          </div>
        </div>
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
