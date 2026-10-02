/* global pdfjsLib, SATParser, SATAnalyzer */

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

  function pausedSession(deck) {
    const session = deck.pausedSession;
    if (!session || !Array.isArray(session.sequence) || !session.sequence.length) return null;
    const questionIds = new Set(deck.questions.map((question) => question.questionId));
    const sequence = session.sequence.filter((id) => questionIds.has(id));
    if (!sequence.length) return null;
    return {
      sequence,
      sequenceLabel: session.sequenceLabel || "",
      quizIndex: Math.min(Math.max(Number(session.quizIndex) || 0, 0), sequence.length - 1),
      pausedAt: session.pausedAt || null,
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
    const paused = pausedSession(deck);
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
        <div class="deck-meta">
          ${paused ? `<span class="pill paused-pill">Paused · Question ${paused.quizIndex + 1} of ${paused.sequence.length}</span>` : ""}
          ${metadata.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}
        </div>
        <div class="deck-stats">
          <div><span class="stat-label">Progress</span><span class="stat-value">${stats.answered} / ${deck.questions.length}</span></div>
          <div><span class="stat-label">Accuracy</span><span class="stat-value">${stats.accuracy === null ? "—" : `${stats.accuracy}%`}</span></div>
        </div>
        <div class="mini-progress" role="progressbar" aria-label="Deck progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(stats.percent)}"><span style="width:${stats.percent}%"></span></div>
        <button class="button primary" data-action="continue">${paused ? "Resume session" : stats.answered === deck.questions.length && deck.questions.length ? "View results" : stats.answered ? "Continue" : "Start practice"}</button>
      </article>`;
  }

  function emptyState() {
    return `
      <div class="empty-state">
        <div>
          <div class="empty-icon" aria-hidden="true">＋</div>
          <h2>Turn a PDF into practice</h2>
          <p>Import an SAT Educator Question Bank PDF. Math equations, diagrams, answer choices, explanations, and progress stay on this device.</p>
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

  function positionedLines(items = []) {
    const positioned = items
      .filter((item) => item && typeof item.str === "string" && item.str.trim())
      .map((item) => ({
        text: item.str,
        x: Number(item.transform?.[4] ?? 0),
        y: Number(item.transform?.[5] ?? 0),
        width: Number(item.width ?? 0),
        height: Math.max(8, Math.abs(Number(item.height ?? item.transform?.[3] ?? 10))),
      }));
    const lines = [];
    positioned.sort((a, b) => Math.abs(b.y - a.y) > 2.5 ? b.y - a.y : a.x - b.x).forEach((item) => {
      let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2.5);
      if (!line) {
        line = { y: item.y, height: item.height, items: [] };
        lines.push(line);
      }
      line.height = Math.max(line.height, item.height);
      line.items.push(item);
    });
    return lines.map((line) => ({
      ...line,
      text: SATParser.cleanInline(line.items.sort((a, b) => a.x - b.x).map((item) => item.text).join(" ")),
    }));
  }

  function visualSegments(question, pageItems) {
    const escapedId = question.questionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const startPattern = new RegExp(`^ID\\s*:\\s*${escapedId}\\s*$`, "i");
    const segments = [];
    let foundEnd = false;
    for (let pageNumber = question.sourcePage; pageNumber <= (question.sourceEndPage || question.sourcePage); pageNumber += 1) {
      const lines = positionedLines(pageItems[pageNumber - 1]);
      const startLine = pageNumber === question.sourcePage ? lines.find((line) => startPattern.test(line.text)) : null;
      const endLine = lines.find((line) => /^Correct Answer\s*:/i.test(line.text) && (!startLine || line.y < startLine.y));
      const meaningfulBeforeEnd = !endLine || lines.some((line) =>
        line.y > endLine.y &&
        !new RegExp(`^ID\\s*:\\s*${escapedId}\\s+Answer$`, "i").test(line.text) &&
        !/^\s*$/.test(line.text)
      );
      if (meaningfulBeforeEnd) segments.push({ pageNumber, startLine, endLine });
      if (endLine) {
        foundEnd = true;
        break;
      }
    }
    return foundEnd ? segments : [];
  }

  async function renderQuestionVisuals(question, pages, pageItems) {
    const segments = visualSegments(question, pageItems);
    const visuals = [];
    for (const segment of segments) {
      const page = pages[segment.pageNumber - 1];
      const viewport = page.getViewport({ scale: 1.4 });
      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = Math.ceil(viewport.width);
      pageCanvas.height = Math.ceil(viewport.height);
      const pageContext = pageCanvas.getContext("2d", { alpha: false });
      pageContext.fillStyle = "#fff";
      pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      await page.render({ canvasContext: pageContext, viewport }).promise;

      const toViewportY = (pdfY) => viewport.convertToViewportPoint(0, pdfY)[1];
      const proposedTop = segment.startLine
        ? Math.max(0, Math.floor(toViewportY(segment.startLine.y + segment.startLine.height) - 16))
        : 0;
      const proposedBottom = segment.endLine
        ? Math.min(pageCanvas.height, Math.ceil(toViewportY(segment.endLine.y + segment.endLine.height) - 8))
        : pageCanvas.height;
      if (proposedBottom - proposedTop < 40) continue;

      // Trim print margins at the first sustained blank gap. This keeps the
      // original equations and diagrams while avoiding a page of whitespace
      // (and ignores browser-print footers below that gap).
      const context = pageCanvas.getContext("2d", { willReadFrequently: true });
      const pixels = context.getImageData(0, proposedTop, pageCanvas.width, proposedBottom - proposedTop);
      let minX = pageCanvas.width;
      let maxX = 0;
      let lastInkRow = 0;
      let seenInk = false;
      const blankGap = 120;
      for (let y = 0; y < pixels.height; y += 1) {
        let rowHasInk = false;
        for (let x = 0; x < pixels.width; x += 2) {
          const offset = (y * pixels.width + x) * 4;
          if (pixels.data[offset] < 248 || pixels.data[offset + 1] < 248 || pixels.data[offset + 2] < 248) {
            rowHasInk = true;
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
          }
        }
        if (rowHasInk) {
          seenInk = true;
          lastInkRow = y;
        } else if (seenInk && y - lastInkRow > blankGap) {
          break;
        }
      }
      if (!seenInk) continue;
      const left = Math.max(0, minX - 24);
      const right = Math.min(pageCanvas.width, maxX + 26);
      const top = proposedTop;
      const bottom = Math.min(proposedBottom, proposedTop + lastInkRow + 24);
      const crop = document.createElement("canvas");
      crop.width = right - left;
      crop.height = bottom - top;
      crop.getContext("2d", { alpha: false }).drawImage(pageCanvas, left, top, crop.width, crop.height, 0, 0, crop.width, crop.height);
      visuals.push(crop.toDataURL("image/webp", 0.86));
    }
    return visuals;
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
      const pages = [];
      const pageItems = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const progress = document.querySelector("#import-progress");
        if (progress) progress.textContent = `Extracting page ${pageNumber} of ${pdf.numPages}…`;
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent({ includeMarkedContent: false });
        pages.push(page);
        pageItems.push(content.items);
        pageTexts.push(SATParser.textItemsToLines(content.items));
      }
      const parsed = SATParser.parseSatPages(pageTexts);
      if (!parsed.questions.length) {
        state.preview = { file, ...parsed };
        renderImportFailure("No complete SAT questions were detected. Open diagnostics below to inspect the extracted text.");
        return;
      }
      for (let index = 0; index < parsed.questions.length; index += 1) {
        const question = parsed.questions[index];
        const sourceText = pageTexts.slice(question.sourcePage - 1, question.sourceEndPage || question.sourcePage).join("\n");
        const isMath = /^Math$/i.test(question.test) || /\bMath\b/i.test(sourceText);
        if (!isMath) continue;
        const progress = document.querySelector("#import-progress");
        if (progress) progress.textContent = `Formatting math question ${index + 1} of ${parsed.questions.length}…`;
        question.visualPages = await renderQuestionVisuals(question, pages, pageItems);
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
    const savedSession = !options.sequence ? pausedSession(deck) : null;
    if (options.sequence) {
      state.sequence = options.sequence;
      state.sequenceLabel = options.label || "Review";
      state.quizIndex = options.startIndex || 0;
    } else if (savedSession) {
      state.sequence = savedSession.sequence;
      state.sequenceLabel = savedSession.sequenceLabel;
      state.quizIndex = savedSession.quizIndex;
    } else {
      state.sequence = deck.questions.map((question) => question.questionId);
      state.sequenceLabel = "";
      const firstUnanswered = deck.questions.findIndex((question) => !question.answered);
      state.quizIndex = firstUnanswered >= 0 ? firstUnanswered : 0;
    }
    if (deck.questions.length && deck.questions.every((question) => question.answered) && !options.forceQuiz && !savedSession) renderResults();
    else renderQuiz();
  }

  async function pauseCurrentSession() {
    const deck = currentDeck();
    if (!deck || !currentQuestion()) return renderDecks();
    deck.pausedSession = {
      sequence: [...state.sequence],
      sequenceLabel: state.sequenceLabel,
      quizIndex: state.quizIndex,
      pausedAt: new Date().toISOString(),
    };
    await saveDeck(deck);
    renderDecks();
    toast("Session paused — resume whenever you're ready");
  }

  function renderQuiz() {
    const deck = currentDeck();
    const question = currentQuestion();
    if (!deck || !question) return renderDecks();
    const position = state.quizIndex + 1;
    setHeader(deck.name, `<span class="question-count">${escapeHtml(state.sequenceLabel ? `${state.sequenceLabel} · ` : "")}Question ${position} of ${state.sequence.length}</span><button class="button secondary text-button" data-header-action="pause">Pause &amp; exit</button>`);
    const answerEntries = Object.entries(question.answers);
    const isStudentProduced = question.responseType === "student-produced";
    const hasVisual = Array.isArray(question.visualPages) && question.visualPages.length > 0;
    appMain.innerHTML = `
      <section class="quiz-page" aria-labelledby="question-prompt">
        <div class="question-meta">
          ${[question.test, question.domain, question.skill, question.difficulty].filter(Boolean).map((value) => `<span class="pill">${escapeHtml(value)}</span>`).join("")}
        </div>
        ${hasVisual ? `<h1 id="question-prompt" class="sr-only">SAT Math question ${escapeHtml(question.questionId)}</h1>` : ""}
        <article class="question-card">
          ${hasVisual ? `<div class="question-visuals">${question.visualPages.map((source, index) => `<img src="${source}" alt="Question ${escapeHtml(question.questionId)}${question.visualPages.length > 1 ? `, part ${index + 1}` : ""}">`).join("")}</div>` : `
            ${question.passage ? `<p class="passage">${escapeHtml(question.passage)}</p>` : ""}
            <p class="prompt" id="question-prompt">${escapeHtml(question.prompt || question.passage)}</p>`}
        </article>
        ${isStudentProduced ? studentResponseHtml(question) : `
          <div class="answers${hasVisual ? " visual-choice-picker" : ""}" role="group" aria-label="Answer choices">
            ${answerEntries.map(([letter, answer]) => answerButton(question, letter, answer, hasVisual)).join("")}
          </div>`}
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

  function studentResponseHtml(question) {
    const disabled = question.answered ? "disabled" : "";
    const statusClass = question.answered ? " correct" : question.lastIncorrectAnswer ? " incorrect" : "";
    return `<div class="student-response${statusClass}">
      <label for="student-response-input">Enter your answer</label>
      <p>Use a decimal, integer, or fraction (for example, <span class="math-text">2/3</span>).</p>
      <input id="student-response-input" class="student-response-input" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="${escapeHtml(question.selectedAnswer || "")}" ${disabled}>
    </div>`;
  }

  function answerButton(question, letter, text, compact = false) {
    const selected = question.selectedAnswer === letter;
    const correct = question.answered && question.correctAnswer === letter;
    const incorrect = !question.answered && question.lastIncorrectAnswer === letter;
    const classes = ["answer", selected && !question.answered ? "selected" : "", correct ? "correct" : "", incorrect ? "incorrect" : ""].filter(Boolean).join(" ");
    let result = "";
    if (correct) result = "✓ Correct answer";
    else if (incorrect) result = "✕ Try again";
    return `<button class="${classes}" data-answer="${letter}" ${question.answered ? "disabled" : ""} aria-pressed="${selected}" aria-label="Select choice ${letter}">
      <span class="answer-letter">${letter}</span>${compact ? `<span class="answer-text">Select ${letter}</span>` : `<span class="answer-text">${escapeHtml(text)}</span>`}${result ? `<span class="answer-result">${result}</span>` : ""}
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
    if (!question || question.answered || !Object.prototype.hasOwnProperty.call(question.answers, letter)) return;
    question.selectedAnswer = letter;
    question.lastIncorrectAnswer = null;
    renderQuiz();
    document.querySelector(`[data-answer="${letter}"]`)?.focus();
  }

  async function checkAnswer() {
    const deck = currentDeck();
    const question = currentQuestion();
    if (!question?.selectedAnswer || question.answered) return;
    const isCorrect = question.responseType === "student-produced"
      ? SATParser.isAcceptedResponse(question.selectedAnswer, question.acceptedAnswers || [question.correctAnswer])
      : question.selectedAnswer === question.correctAnswer;
    if (!isCorrect) {
      question.mistakeHistory = Array.isArray(question.mistakeHistory) ? question.mistakeHistory : [];
      question.mistakeHistory.push({ answer: question.selectedAnswer, at: new Date().toISOString() });
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

  async function nextQuestion() {
    const question = currentQuestion();
    if (!question?.answered) return;
    if (state.quizIndex < state.sequence.length - 1) {
      state.quizIndex += 1;
      renderQuiz();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      const deck = currentDeck();
      if (deck?.pausedSession) {
        delete deck.pausedSession;
        await saveDeck(deck);
      }
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

  function weakSpotsHtml(mistakes) {
    if (!mistakes.length) return "";
    const groups = SATAnalyzer.analyzeWeakSpots(mistakes);
    const totalAttempts = mistakes.reduce((sum, question) => sum + (question.incorrectAttempts || 0), 0);
    const repeatedPatterns = groups.filter((group) => group.repeated).length;
    return `
      <section class="weak-spots" id="weak-spots" tabindex="-1" aria-labelledby="weak-spots-title">
        <div class="weak-spots-heading">
          <div>
            <p class="eyebrow">Personal study plan</p>
            <h2 id="weak-spots-title">Performance analysis</h2>
            <p>Analyzed the content of ${mistakes.length} missed ${mistakes.length === 1 ? "question" : "questions"} and ${totalAttempts} wrong ${totalAttempts === 1 ? "selection" : "selections"}. ${repeatedPatterns ? `${repeatedPatterns} repeated ${repeatedPatterns === 1 ? "pattern was" : "patterns were"} found across different questions.` : "No weakness repeats across multiple questions yet."}</p>
          </div>
          <span class="weak-count">${groups.length} ${groups.length === 1 ? "concept" : "concepts"}</span>
        </div>
        <div class="weak-spot-list">${groups.map(weakSpotCard).join("")}</div>
      </section>`;
  }

  function weakSpotCard(group) {
    return `
      <article class="weak-spot-card">
        <div class="weak-spot-top">
          <div>
            <div class="weak-spot-meta">
              <span class="pill">${escapeHtml(group.category)}</span>
              <span class="pill pattern-pill ${group.repeated ? "repeated" : "detected"}">${group.repeated ? "Repeated pattern" : "Detected weakness"}</span>
              ${[...group.difficulties].map((difficulty) => `<span class="pill">${escapeHtml(difficulty)}</span>`).join("")}
            </div>
            <h3>${escapeHtml(group.label)}</h3>
            <p class="theory-title">${group.repeated ? `Appeared in ${group.questions.length} different missed questions` : `Detected in ${group.questions.length} missed question`}</p>
          </div>
          <div class="attempt-badge"><strong>${group.attempts}</strong><span>wrong ${group.attempts === 1 ? "selection" : "selections"}</span></div>
        </div>
        ${group.evidence ? `<div class="analysis-evidence"><strong>Why this was diagnosed</strong><span>${escapeHtml(group.evidence)}</span></div>` : ""}
        <h4 class="refresh-heading">What to refresh</h4>
        <ul class="theory-list">${group.concepts.map((concept) => `<li>${escapeHtml(concept)}</li>`).join("")}</ul>
        <div class="practice-tip"><strong>How to practice</strong><span>${escapeHtml(group.practice)}</span></div>
        <details class="rationale-review">
          <summary>Review ${group.questions.length === 1 ? "the missed question" : `${group.questions.length} missed questions`} and official explanations</summary>
          <div class="rationale-list">
            ${group.questions.map((question) => `
              <article>
                <strong>Question ${escapeHtml(question.questionId)}</strong>
                <span>${question.incorrectAttempts || 1} missed ${(question.incorrectAttempts || 1) === 1 ? "attempt" : "attempts"}</span>
                ${question.mistakeHistory?.length ? `<span class="wrong-choice-history">Wrong choices: ${escapeHtml(unique(question.mistakeHistory.map((attempt) => typeof attempt === "string" ? attempt : attempt.answer)).join(", "))}</span>` : ""}
                <p>${escapeHtml(question.rationale || "No rationale was available in the extracted PDF text.")}</p>
              </article>`).join("")}
          </div>
        </details>
      </article>`;
  }

  function renderResults() {
    const deck = currentDeck();
    if (!deck) return renderDecks();
    state.sequence = [];
    state.sequenceLabel = "";
    state.quizIndex = 0;
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
    deck.questions.forEach((question) => Object.assign(question, { selectedAnswer: null, answered: false, correct: null, incorrectAttempts: 0, lastIncorrectAnswer: null, mistakeHistory: [] }));
    delete deck.pausedSession;
    await saveDeck(deck);
    toast("Deck progress reset");
    return true;
  }

  async function retryMistakes() {
    const deck = currentDeck();
    const ids = deck.questions.filter((question) => (question.incorrectAttempts || 0) > 0).map((question) => question.questionId);
    deck.questions.filter((question) => ids.includes(question.questionId)).forEach((question) => Object.assign(question, { selectedAnswer: null, answered: false, correct: null, incorrectAttempts: 0, lastIncorrectAnswer: null, mistakeHistory: [] }));
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

  appMain.addEventListener("input", (event) => {
    if (event.target.id !== "student-response-input") return;
    const question = currentQuestion();
    if (!question || question.answered) return;
    question.selectedAnswer = event.target.value;
    document.querySelector("[data-quiz-action='check']")?.toggleAttribute("disabled", !event.target.value.trim());
  });

  appMain.addEventListener("keydown", (event) => {
    if (event.target.id !== "student-response-input" || event.key !== "Enter") return;
    event.preventDefault();
    checkAnswer();
  });

  headerActions.addEventListener("click", (event) => {
    if (event.target.closest("[data-header-action='pause']")) pauseCurrentSession();
    else if (event.target.closest("[data-header-action='decks']")) renderDecks();
  });
  document.querySelector("#brand-button").addEventListener("click", () => {
    if (currentQuestion()) pauseCurrentSession();
    else renderDecks();
  });

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
    if (question.responseType !== "student-produced" && ANSWER_KEYS[key] && !question.answered) {
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
          question.mistakeHistory = question.selectedAnswer ? [{ answer: question.selectedAnswer, at: null }] : [];
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
