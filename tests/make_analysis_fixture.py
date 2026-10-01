from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.pagesizes import letter

OUTPUT = "tests/sat-content-analysis-fixture.pdf"
LINES = [
    "Question ID: e44db0a0",
    "Assessment", "SAT", "Test", "Reading and Writing",
    "Domain", "Standard English Conventions",
    "Skill", "Form, Structure, and Sense", "Difficulty", "Medium",
    "Question",
    "A cycle of lunar phases ______ about twenty-nine days.",
    "Which choice completes the text so that it conforms to the conventions of Standard English?",
    "Answer",
    "A. are taking", "B. have taken", "C. take", "D. takes",
    "Correct Answer: D", "Rationale",
    "Choice D is the best answer. The convention being tested is subject-verb agreement.",
    "The singular verb takes agrees in number with the singular subject a cycle of lunar phases.",
    "Choice A is incorrect because the plural verb are taking doesn't agree in number with the",
    "singular subject a cycle of lunar phases. Choice B is incorrect because the plural verb",
    "have taken doesn't agree in number with the singular subject a cycle of lunar phases.",
    "Choice C is incorrect because the plural verb take doesn't agree in number with the singular subject.",
]

canvas = Canvas(OUTPUT, pagesize=letter)
canvas.setFont("Helvetica", 9)
y = 760
for line in LINES:
    canvas.drawString(45, y, line)
    y -= 25 if line in {"Question", "Answer", "Rationale"} else 17
canvas.save()
print(OUTPUT)
