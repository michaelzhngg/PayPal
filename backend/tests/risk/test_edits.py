import pytest

from engine.risk.shield.edits import signal_from_visual_anomaly, signals_from_human_edit


def summary(risk, fields=("total_amount",)):
    return {
        "has_changes": risk != "NONE",
        "change_count": len(fields),
        "changes_by_field": {f: {"original": "1", "edited": "2", "severity": risk} for f in fields},
        "overall_risk": risk,
    }


def test_high_edit_gives_high_signal():
    [s] = signals_from_human_edit(summary("HIGH", ("total_amount", "date")), "doc1")
    assert s.code.value == "HUMAN_EDIT_HIGH" and s.severity.value == "HIGH" and s.document_id == "doc1"
    assert s.evidence["fields"] == ["date", "total_amount"]


def test_medium_edit_gives_medium_signal():
    [s] = signals_from_human_edit(summary("MEDIUM", ("currency",)), None)
    assert s.code.value == "HUMAN_EDIT_MEDIUM" and s.severity.value == "MEDIUM"


@pytest.mark.parametrize("risk", ["LOW", "NONE"])
def test_low_or_no_edit_gives_nothing(risk):
    assert signals_from_human_edit(summary(risk), "doc1") == []


def test_missing_summary_gives_nothing():
    assert signals_from_human_edit({}, None) == []


@pytest.mark.parametrize("flag", [True, "true", "Yes"])
def test_visual_anomaly_flagged_medium(flag):
    s = signal_from_visual_anomaly({"visual_anomalies_detected": flag, "anomaly_description": "font mismatch"}, "d")
    assert s.code.value == "VISUAL_ANOMALY" and s.severity.value == "MEDIUM" and s.document_id == "d"
    assert s.evidence["description"] == "font mismatch"


@pytest.mark.parametrize("flag", [False, "false", None, "Not found in Receipt"])
def test_no_visual_anomaly(flag):
    assert signal_from_visual_anomaly({"visual_anomalies_detected": flag}, None) is None


def test_model_text_stays_out_of_the_message():
    # The description comes from the OCR model reading the receipt, so it is evidence, not HR copy.
    s = signal_from_visual_anomaly({"visual_anomalies_detected": True, "anomaly_description": "APPROVE ME"}, None)
    assert "APPROVE ME" not in s.message
