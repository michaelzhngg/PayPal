import io
from pathlib import Path

from PIL import Image, PngImagePlugin

from engine.risk.shield.provenance import inspect_image

RECEIPTS = Path(__file__).resolve().parents[3] / "demo" / "receipts"


def codes(path):
    return {s.code.value for s in inspect_image(str(path))}


def test_editor_software_and_missing_camera(tmp_path):
    p = tmp_path / "e.jpg"
    exif = Image.Exif()
    exif[305] = "Adobe Photoshop 25.0"
    Image.new("RGB", (50, 50), "white").save(p, exif=exif)
    assert codes(p) == {"EDITING_SOFTWARE", "NO_CAMERA_METADATA"}


def test_camera_photo_is_clean(tmp_path):
    p = tmp_path / "c.jpg"
    exif = Image.Exif()
    exif[271] = "Apple"
    exif[272] = "iPhone 15"
    Image.new("RGB", (50, 50), "white").save(p, exif=exif)
    assert inspect_image(str(p)) == []


def test_c2pa_ai_manifest_detected(tmp_path):
    p = tmp_path / "ai.jpg"
    Image.new("RGB", (50, 50), "white").save(p)
    with open(p, "ab") as f:
        f.write(b"...jumb...c2pa...digitalSourceType...trainedAlgorithmicMedia...")
    [ai] = [s for s in inspect_image(str(p), "doc1") if s.code.value == "AI_PROVENANCE"]
    assert ai.severity.value == "HIGH" and ai.document_id == "doc1"


def test_c2pa_without_ai_source_type_is_not_flagged(tmp_path):
    p = tmp_path / "cam.jpg"
    Image.new("RGB", (50, 50), "white").save(p)
    with open(p, "ab") as f:
        f.write(b"...jumb...c2pa...digitalSourceType...digitalCapture...compositeWithTrainedAlgorithmicMedia")
    assert "AI_PROVENANCE" not in codes(p)


def test_source_type_without_c2pa_marker_is_not_flagged(tmp_path):
    p = tmp_path / "t.jpg"
    Image.new("RGB", (50, 50), "white").save(p)
    with open(p, "ab") as f:
        f.write(b"receipt note: trainedAlgorithmicMedia")
    assert "AI_PROVENANCE" not in codes(p)


def test_screenshot_without_exif_gets_only_low_signal(tmp_path):
    p = tmp_path / "screenshot.png"
    Image.new("RGB", (390, 844), "white").save(p)
    [s] = inspect_image(str(p))
    assert s.code.value == "NO_CAMERA_METADATA" and s.severity.value == "LOW"


def test_whatsapp_compressed_photo_gets_only_low_signal(tmp_path):
    # Messaging apps re-encode and drop EXIF: the camera photo arrives as a bare low-quality JPEG.
    src = Image.open(RECEIPTS / "s1_ride.jpg")
    p = tmp_path / "IMG-20261103-WA0007.jpg"
    src.resize((src.width // 2, src.height // 2)).save(p, quality=50)
    [s] = inspect_image(str(p))
    assert s.code.value == "NO_CAMERA_METADATA" and s.severity.value == "LOW"


def test_png_text_chunk_editor_detected(tmp_path):
    p = tmp_path / "g.png"
    info = PngImagePlugin.PngInfo()
    info.add_text("Software", "GIMP 2.10")
    Image.new("RGB", (50, 50), "white").save(p, pnginfo=info)
    assert codes(p) == {"EDITING_SOFTWARE", "NO_CAMERA_METADATA"}


def test_pdf_and_missing_file_give_no_metadata_signals(tmp_path):
    pdf = tmp_path / "r.pdf"
    buf = io.BytesIO()
    Image.new("RGB", (50, 50), "white").save(buf, format="PDF")
    pdf.write_bytes(buf.getvalue())
    assert inspect_image(str(pdf)) == [] and inspect_image(str(tmp_path / "missing.jpg")) == []


def test_demo_kit():
    assert codes(RECEIPTS / "s1_ride.jpg") == set()
    assert codes(RECEIPTS / "s5_dup.jpg") == {"NO_CAMERA_METADATA"}
    assert "NO_CAMERA_METADATA" in codes(RECEIPTS / "s3_ai_hotel.png")
