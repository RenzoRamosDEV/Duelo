"""Puerto del limitador de peticiones."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True, slots=True)
class RateLimitDecision:
    allowed: bool
    # Segundos (enteros, >= 1) hasta que se libere cupo; 0 si la petición está permitida.
    retry_after_seconds: int


class RateLimiter(Protocol):
    async def hit(self, key: str) -> RateLimitDecision:
        """Registra una petición de `key` y dice si cabe en el cupo. Las rechazadas no cuentan
        contra el cupo (no prolongan el bloqueo)."""
        ...
