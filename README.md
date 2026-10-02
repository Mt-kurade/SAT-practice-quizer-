# SAT Practice

A private, local web app that turns SAT Educator Question Bank PDF exports into persistent quiz decks. PDF processing and deck data stay in your browser.

## Use it

1. Open `index.html` in a modern browser.
2. Import an SAT Educator Question Bank PDF.
3. Name the deck.
4. Practice.

Use **Pause & exit** during a session to save the exact question and practice sequence. The deck card will show that the session is paused, and **Resume session** picks up at the same place later—even after closing the browser.

The bundled PDF.js files make normal `file://` use possible. If your browser blocks local scripts or storage, run an optional local server from this folder:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`. A local server is not required for most current browsers and does not upload any data.

Text-based Reading and Writing and Math exports are supported. Math imports are parsed across page boundaries and displayed from spoiler-safe original-PDF crops, preserving equations, graphs, tables, diagrams, and graphical answer choices. They can contain either four-option multiple-choice questions or student-produced responses (grid-ins). Grid-ins accept equivalent integer, decimal, and fraction forms when the PDF lists a numeric answer.

Fully scanned PDFs without extractable Question Bank labels cannot be indexed automatically and are reported in import diagnostics.

## Automated checks

```powershell
node tests/parser.test.js
node tests/analysis.test.js
```
