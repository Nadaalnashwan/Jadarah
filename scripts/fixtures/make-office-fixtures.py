"""Generate the real PowerPoint / Excel fixtures used by the extraction tests and the live evaluation harness.

    python3 scripts/fixtures/make-office-fixtures.py

Requires python-pptx, openpyxl and LibreOffice (`soffice`). The workbook is round-tripped through LibreOffice so that it
has a shared-strings table and cached formula values, like a file saved by a spreadsheet application.
Outputs (tests/fixtures/evaluation/): forecast.pptx, image-only.pptx, budget.xlsx, empty.xlsx, protected.xlsx.
"""

import os
import shutil
import subprocess
import tempfile

from openpyxl import Workbook
from pptx import Presentation
from pptx.util import Inches

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "tests", "fixtures", "evaluation"))


def forecast_pptx(path: str) -> None:
    prs = Presentation()
    title = prs.slides.add_slide(prs.slide_layouts[0])
    title.shapes.title.text = "Q3 demand forecast"
    title.placeholders[1].text = "Inventory planning, Riyadh warehouse"
    body = prs.slides.add_slide(prs.slide_layouts[1])
    body.shapes.title.text = "Forecast and safety stock"
    tf = body.placeholders[1].text_frame
    tf.text = "Forecast for SKU-118: 1,240 units in Q3"
    for line in ["Safety stock: 180 units (two weeks of demand)", "Method: 3-month moving average adjusted for Ramadan"]:
        tf.add_paragraph().text = line
    body.notes_slide.notes_text_frame.text = "Assumes no promotion in July"
    risk = prs.slides.add_slide(prs.slide_layouts[1])
    risk.shapes.title.text = "Risks"
    risk.placeholders[1].text_frame.text = "Supplier lead time rose from 9 to 14 days"
    prs.save(path)


def image_only_pptx(path: str) -> None:
    prs = Presentation()
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank layout: no text placeholders
    slide.shapes.add_picture(os.path.join(OUT, "photo.jpg"), Inches(1), Inches(1), width=Inches(6))
    prs.save(path)


def via_libreoffice(src: str, dest: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["soffice", "--headless", "--calc", "--convert-to", "xlsx:Calc MS Excel 2007 XML", "--outdir", tmp, src], check=True, capture_output=True)
        shutil.move(os.path.join(tmp, os.path.basename(src)), dest)


def budget_xlsx(path: str) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Budget"
    ws.append(["Item", "Q1 (SAR)", "Q2 (SAR)", "Total (SAR)"])
    ws.append(["Marketing", 12000, 15500, "=B2+C2"])
    ws.append(["Salaries", 84000, 84000, "=B3+C3"])
    ws.append(["Total", "=SUM(B2:B3)", "=SUM(C2:C3)", "=SUM(D2:D3)"])
    notes = wb.create_sheet("Notes")
    notes.append(["Q2 marketing variance is explained by the Riyadh Season campaign"])
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "budget.xlsx")
        wb.save(raw)
        via_libreoffice(raw, path)


def protected_xlsx(path: str) -> None:
    """A real password-protected workbook: stored through the LibreOffice UNO API with a password, which writes an
    encrypted OLE container (the same format Excel uses). Command-line filter options do not encrypt."""
    import time

    import uno  # LibreOffice's Python bridge
    from com.sun.star.beans import PropertyValue

    def prop(name, value):
        p = PropertyValue()
        p.Name, p.Value = name, value
        return p

    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
        raw = os.path.join(tmp, "plain.xlsx")
        wb = Workbook()
        wb.active.append(["Confidential", 42])
        wb.save(raw)
        proc = subprocess.Popen(["soffice", "--headless", "--invisible", "--norestore", f"-env:UserInstallation=file://{tmp}/profile",
                                 "--accept=socket,host=127.0.0.1,port=2083;urp;"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            ctx = None
            resolver = uno.getComponentContext().ServiceManager.createInstanceWithContext("com.sun.star.bridge.UnoUrlResolver", uno.getComponentContext())
            for _ in range(60):
                try:
                    ctx = resolver.resolve("uno:socket,host=127.0.0.1,port=2083;urp;StarOffice.ComponentContext")
                    break
                except Exception:
                    time.sleep(0.5)
            if ctx is None:
                raise RuntimeError("LibreOffice did not start")
            desktop = ctx.ServiceManager.createInstanceWithContext("com.sun.star.frame.Desktop", ctx)
            doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(raw), "_blank", 0, (prop("Hidden", True),))
            doc.storeToURL(uno.systemPathToFileUrl(path), (prop("FilterName", "Calc MS Excel 2007 XML"), prop("Password", "fixture")))
            doc.close(True)
            try:
                desktop.terminate()
            except Exception:
                pass
        finally:
            try:
                proc.wait(timeout=30)  # terminate() above lets LibreOffice exit cleanly
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=30)
    with open(path, "rb") as f:
        if f.read(8) != bytes.fromhex("d0cf11e0a1b11ae1"):
            raise RuntimeError("protected.xlsx was not encrypted")


def empty_xlsx(path: str) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        raw = os.path.join(tmp, "empty.xlsx")
        Workbook().save(raw)
        via_libreoffice(raw, path)


if __name__ == "__main__":
    forecast_pptx(os.path.join(OUT, "forecast.pptx"))
    image_only_pptx(os.path.join(OUT, "image-only.pptx"))
    budget_xlsx(os.path.join(OUT, "budget.xlsx"))
    empty_xlsx(os.path.join(OUT, "empty.xlsx"))
    protected_xlsx(os.path.join(OUT, "protected.xlsx"))
    print("written:", ", ".join(sorted(f for f in os.listdir(OUT) if f.endswith((".pptx", ".xlsx")))))
