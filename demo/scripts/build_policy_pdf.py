# /// script
# requires-python = ">=3.11"
# dependencies = ["reportlab>=4.2", "pymupdf>=1.24"]
# ///
"""Render demo/policy/reclaim-pay-demo-policy.md to a PDF that Policy Studio accepts.

Policy upload takes PDFs only and reads them with pymupdf4llm, so the output keeps
real text and ruled tables for the extraction agent.

    uv run demo/scripts/build_policy_pdf.py
    uv run demo/scripts/build_policy_pdf.py --check   # also print the text pymupdf extracts

Handles the Markdown subset the policy uses: headings, paragraphs, bullet and
numbered lists, pipe tables, blockquotes and **bold**.
"""
import argparse
import re
from pathlib import Path

import pymupdf
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

DEMO_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SRC = DEMO_DIR / "policy" / "reclaim-pay-demo-policy.md"
DEFAULT_OUT = DEMO_DIR / "policy" / "reclaim-pay-demo-policy.pdf"

# Base-14 Helvetica on purpose: ReportLab does no shaping, so "fi" and "ff" never
# become ligature glyphs. pymupdf4llm 1.27 silently drops lines that contain them.
STYLES = getSampleStyleSheet()
BODY = ParagraphStyle("Body", parent=STYLES["BodyText"], fontName="Helvetica", fontSize=10.5, leading=14)
QUOTE = ParagraphStyle("Quote", parent=BODY, fontName="Helvetica-Oblique", textColor=colors.HexColor("#444444"), leftIndent=12)
HEADINGS = {
    1: ParagraphStyle("H1", parent=STYLES["Heading1"], fontName="Helvetica-Bold", fontSize=20, leading=24),
    2: ParagraphStyle("H2", parent=STYLES["Heading2"], fontName="Helvetica-Bold", fontSize=14, leading=18, spaceBefore=12),
    3: ParagraphStyle("H3", parent=STYLES["Heading3"], fontName="Helvetica-Bold", fontSize=12, leading=15, spaceBefore=8),
}


def inline(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)


def table(rows: list[str]) -> Table:
    cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows]
    cells = [r for r in cells if not all(set(c) <= {"-", ":"} for c in r)]
    data = [[Paragraph(inline(c), BODY) for c in r] for r in cells]
    t = Table(data, hAlign="LEFT", colWidths=[60 * mm, 50 * mm])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#888888")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#eeeeee")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def parse(md: str) -> list:
    story: list = []
    lines = md.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            i += 1
            continue
        if m := re.match(r"(#{1,3}) (.*)", line):
            story.append(Paragraph(inline(m.group(2)), HEADINGS[len(m.group(1))]))
            i += 1
            continue
        block = []
        if line.startswith("|"):
            while i < len(lines) and lines[i].startswith("|"):
                block.append(lines[i])
                i += 1
            story += [table(block), Spacer(1, 6)]
            continue
        if line.startswith(">"):
            while i < len(lines) and lines[i].startswith(">"):
                block.append(lines[i].lstrip("> "))
                i += 1
            story.append(Paragraph(inline(" ".join(block)), QUOTE))
            continue
        list_kind = "bullet" if re.match(r"- ", line) else "1" if re.match(r"\d+\. ", line) else None
        if list_kind:
            items: list[str] = []
            while i < len(lines) and lines[i].strip() and not lines[i].startswith("|"):
                if re.match(r"(- |\d+\. )", lines[i]):
                    items.append(re.sub(r"^(- |\d+\. )", "", lines[i]))
                else:
                    items[-1] += " " + lines[i].strip()
                i += 1
            story.append(ListFlowable(
                [ListItem(Paragraph(inline(t), BODY)) for t in items],
                bulletType=list_kind, bulletFontName="Helvetica", bulletFontSize=10, leftIndent=14,
            ))
            continue
        # Lines that start with a bold label stay on their own line, like the header block.
        while i < len(lines) and lines[i].strip() and not re.match(r"(#|\||>|- |\d+\. )", lines[i]):
            block.append(lines[i].strip())
            i += 1
        joiner = "<br/>" if all(b.startswith("**") for b in block) else " "
        story.append(Paragraph(joiner.join(inline(b) for b in block), BODY))
    return story


def build(src: Path, out: Path) -> None:
    doc = SimpleDocTemplate(
        str(out), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=20 * mm, bottomMargin=20 * mm,
        title="Reclaim Pay Demo Travel Policy", author="Reclaim Pay demo kit",
    )
    doc.build(parse(src.read_text(encoding="utf-8")))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--src", type=Path, default=DEFAULT_SRC, help="Markdown source")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="PDF to write")
    parser.add_argument("--check", action="store_true", help="print the extracted text after building")
    args = parser.parse_args()

    build(args.src, args.out)
    with pymupdf.open(args.out) as pdf:
        print(f"Wrote {args.out} ({pdf.page_count} pages)")
        if args.check:
            for page in pdf:
                print(page.get_text())


if __name__ == "__main__":
    main()
