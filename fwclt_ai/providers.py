from __future__ import annotations

import os
from typing import Any

import requests


class AIProviderError(RuntimeError):
    pass


def is_ai_enabled() -> bool:
    return os.getenv("AI_ENABLED", "true").strip().lower() not in {"0", "false", "no", "off"}


def generate_text(
    *,
    system: str,
    prompt: str,
    temperature: float = 0.1,
    max_tokens: int = 800,
) -> tuple[str, str]:
    if not is_ai_enabled():
        raise AIProviderError("AI is disabled by AI_ENABLED.")

    preferred = os.getenv("AI_PROVIDER", "anthropic").strip().lower()
    providers = [preferred]
    for fallback in ("anthropic", "gemini"):
        if fallback not in providers:
            providers.append(fallback)

    errors: list[str] = []
    for provider in providers:
        try:
            if provider == "anthropic":
                return _anthropic(system, prompt, temperature, max_tokens), "anthropic"
            if provider == "gemini":
                return _gemini(system, prompt, temperature, max_tokens), "gemini"
        except AIProviderError as exc:
            errors.append(f"{provider}: {exc}")

    raise AIProviderError("; ".join(errors) or "No AI provider configured.")


def _anthropic(system: str, prompt: str, temperature: float, max_tokens: int) -> str:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise AIProviderError("ANTHROPIC_API_KEY is not set.")

    model = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": model,
            "system": system,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        timeout=30,
    )
    if resp.status_code >= 400:
        raise AIProviderError(_error_text(resp))
    data = resp.json()
    parts = data.get("content") or []
    text = "".join(str(p.get("text", "")) for p in parts if isinstance(p, dict))
    if not text.strip():
        raise AIProviderError("Anthropic returned an empty response.")
    return text.strip()


def _gemini(system: str, prompt: str, temperature: float, max_tokens: int) -> str:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise AIProviderError("GEMINI_API_KEY is not set.")

    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    resp = requests.post(
        url,
        headers={"x-goog-api-key": key, "content-type": "application/json"},
        json={
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        },
        timeout=30,
    )
    if resp.status_code >= 400:
        raise AIProviderError(_error_text(resp))
    data = resp.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError):
        text = ""
    if not str(text).strip():
        raise AIProviderError("Gemini returned an empty response.")
    return str(text).strip()


def _error_text(resp: requests.Response) -> str:
    try:
        data: Any = resp.json()
        return str(data.get("error", data))[:500]
    except ValueError:
        return resp.text[:500]
