from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import Settings, settings


class DeepSeekError(RuntimeError):
    """Raised when the configured DeepSeek provider cannot return a result."""


class DeepSeekClient:
    def __init__(self, provider_settings: Settings = settings) -> None:
        self.settings = provider_settings

    @property
    def configured(self) -> bool:
        return bool(self.settings.deepseek_api_key)

    def complete(
        self,
        messages: list[dict[str, str]],
        *,
        json_mode: bool = False,
        max_tokens: int = 3000,
        temperature: float = 0.2,
    ) -> str:
        if not self.configured:
            raise DeepSeekError("DEEPSEEK_API_KEY 未配置")

        payload: dict[str, Any] = {
            "model": self.settings.deepseek_model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "stream": False,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            response = httpx.post(
                f"{self.settings.deepseek_base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.settings.deepseek_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.settings.deepseek_timeout_seconds,
            )
            response.raise_for_status()
            body = response.json()
            content = body["choices"][0]["message"]["content"]
            if not isinstance(content, str) or not content.strip():
                raise DeepSeekError("DeepSeek 返回了空内容")
            return content.strip()
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            raise DeepSeekError(f"DeepSeek 调用失败：{type(exc).__name__}") from exc

    def complete_json(
        self,
        messages: list[dict[str, str]],
        *,
        max_tokens: int = 3000,
    ) -> dict[str, Any]:
        content = self.complete(messages, json_mode=True, max_tokens=max_tokens)
        try:
            decoded = json.loads(content)
        except json.JSONDecodeError as exc:
            raise DeepSeekError("DeepSeek 返回内容不是有效 JSON") from exc
        if not isinstance(decoded, dict):
            raise DeepSeekError("DeepSeek JSON 输出不是对象")
        return decoded
