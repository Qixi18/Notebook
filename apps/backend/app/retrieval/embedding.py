from __future__ import annotations

import httpx

from app.core.config import Settings, settings


class EmbeddingError(RuntimeError):
    """Raised when an optional embedding provider cannot answer."""


class EmbeddingClient:
    def __init__(self, provider_settings: Settings = settings) -> None:
        self.settings = provider_settings

    @property
    def configured(self) -> bool:
        return bool(
            self.settings.embedding_base_url
            and self.settings.embedding_api_key
            and self.settings.embedding_model
        )

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not self.configured:
            raise EmbeddingError("Embedding 服务未配置")
        try:
            response = httpx.post(
                f"{self.settings.embedding_base_url.rstrip('/')}/embeddings",
                headers={
                    "Authorization": f"Bearer {self.settings.embedding_api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": self.settings.embedding_model, "input": texts},
                timeout=60,
            )
            response.raise_for_status()
            data = response.json().get("data", [])
            vectors = [item["embedding"] for item in sorted(data, key=lambda item: item["index"])]
            if len(vectors) != len(texts):
                raise EmbeddingError("Embedding 返回数量与输入不一致")
            return vectors
        except (httpx.HTTPError, KeyError, IndexError, TypeError, ValueError) as exc:
            raise EmbeddingError("Embedding 服务调用失败") from exc
