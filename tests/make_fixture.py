from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.pagesizes import letter

OUTPUT = "tests/sat-acceptance-fixture.pdf"
LINES = [
    "Question ID: 37e5c794",
    "Assessment", "SAT", "Test", "Reading and Writing",
    "Domain", "Standard English Conventions",
    "Skill", "Form, Structure, and Sense", "Difficulty", "Hard",
    "Question",
    "Despite being cheap, versatile, and easy to produce, ______ they are made from",
    "nonrenewable petroleum, and most do not biodegrade in landfills.",
    "Which choice completes the text so that it conforms to the conventions of Standard English?",
    "Answer",
    "A. there are two problems associated with commercial plastics:",
    "B. two problems are associated with commercial plastics:",
    "C. commercial plastics' two associated problems are that",
    "D. commercial plastics have two associated problems:",
    "Correct Answer: D",
    "Rationale",
    "Choice D is the best answer. The convention being tested is sentence structure.",
]

canvas = Canvas(OUTPUT, pagesize=letter)
canvas.setFont("Helvetica", 10)
y = 750
for line in LINES:
    canvas.drawString(54, y, line)
    y -= 27 if line in {"Question", "Answer", "Rationale"} else 18
canvas.save()
print(OUTPUT)
