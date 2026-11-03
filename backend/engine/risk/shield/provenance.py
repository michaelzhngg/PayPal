"""EXIF and C2PA checks on an uploaded receipt file.

C2PA is detected by scanning the raw bytes, not by validating the manifest: no reader library runs offline here.
A JUMBF box or C2PA manifest label must appear together with the IPTC `trainedAlgorithmicMedia` source type.
"""

from PIL import Image

from engine.risk.types import RiskSignal, Severity, SignalCode, make_signal

EDITORS = ("photoshop", "gimp", "canva", "picsart", "snapseed", "lightroom", "pixlr", "affinity")

_TAG_MAKE, _TAG_MODEL, _TAG_SOFTWARE = 271, 272, 305
_C2PA_MARKERS = (b"c2pa", b"jumb")
# Case-sensitive on purpose: the IPTC term `compositeWithTrainedAlgorithmicMedia` must not match.
_AI_SOURCE_TYPE = b"trainedAlgorithmicMedia"


def _c2pa_ai(path: str, document_id: str | None) -> RiskSignal | None:
    try:
        with open(path, "rb") as f:
            data = f.read()
    except OSError:
        return None
    if _AI_SOURCE_TYPE not in data or not any(m in data for m in _C2PA_MARKERS):
        return None
    return make_signal(
        SignalCode.AI_PROVENANCE,
        Severity.HIGH,
        "The file carries C2PA Content Credentials that declare it was made by a generative AI model.",
        {"manifest": "c2pa", "digital_source_type": "trainedAlgorithmicMedia", "verified": False},
        document_id,
    )


def _metadata(path: str) -> tuple[str, str, str] | None:
    """(make, model, software) for an image, or None when Pillow can't open it (PDFs included)."""
    try:
        with Image.open(path) as img:
            exif = img.getexif()
            # PNG editors often write Software as a text chunk instead of EXIF.
            software = exif.get(_TAG_SOFTWARE) or img.info.get("Software") or ""
            return (
                str(exif.get(_TAG_MAKE) or "").strip(),
                str(exif.get(_TAG_MODEL) or "").strip(),
                str(software).strip(),
            )
    except (OSError, ValueError, Image.DecompressionBombError):
        return None


def inspect_image(path: str, document_id: str | None = None) -> list[RiskSignal]:
    signals = []
    ai = _c2pa_ai(path, document_id)
    if ai is not None:
        signals.append(ai)

    meta = _metadata(path)
    if meta is None:
        return signals
    make, model, software = meta

    editor = next((e for e in EDITORS if e in software.lower()), None)
    if editor:
        signals.append(
            make_signal(
                SignalCode.EDITING_SOFTWARE,
                Severity.MEDIUM,
                f"The image metadata says it was last saved by {software}, an image editor.",
                {"software": software, "editor": editor},
                document_id,
            )
        )
    if not make and not model:
        signals.append(
            make_signal(
                SignalCode.NO_CAMERA_METADATA,
                Severity.LOW,
                "The image has no camera make or model. Screenshots and photos sent through messaging apps "
                "lose this too, so on its own it means little.",
                {"software": software or None},
                document_id,
            )
        )
    return signals
