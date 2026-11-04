from core.config import settings
from engine import llm


def _vision(monkeypatch, **overrides):
    for name, value in overrides.items():
        monkeypatch.setattr(settings, name, value)
    llm.get_vision_llm.cache_clear()
    try:
        return llm.get_vision_llm()
    finally:
        llm.get_vision_llm.cache_clear()


def test_vision_defaults_to_openrouter(monkeypatch):
    model = _vision(
        monkeypatch,
        OPENROUTER_BASE_URL="https://openrouter.example/v1",
        OPENROUTER_API_KEY="or-key",
        VISION_BASE_URL="",
        VISION_API_KEY="",
    )
    assert model.openai_api_base == "https://openrouter.example/v1"
    assert model.openai_api_key.get_secret_value() == "or-key"


def test_vision_uses_its_own_endpoint_when_set(monkeypatch):
    model = _vision(
        monkeypatch,
        OPENROUTER_BASE_URL="https://openrouter.example/v1",
        OPENROUTER_API_KEY="or-key",
        VISION_BASE_URL="https://gemini.example/v1beta/openai/",
        VISION_API_KEY="gemini-key",
        VISION_MODEL="gemini-3.8-flash",
    )
    assert model.openai_api_base == "https://gemini.example/v1beta/openai/"
    assert model.openai_api_key.get_secret_value() == "gemini-key"
    assert model.model_name == "gemini-3.8-flash"
