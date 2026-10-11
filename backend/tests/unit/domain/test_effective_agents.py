import pytest

from duelo.domain.project import effective_agents

AVAILABLE = ("claude", "codex")


@pytest.mark.parametrize(
    ("saved", "expected"),
    [
        (None, ("claude", "codex")),  # sin selección: todos
        (["codex"], ("codex",)),
        (["codex", "claude"], ("claude", "codex")),  # el orden es el de AGENT_NAMES
        (["gemini"], ("claude", "codex")),  # ninguno sigue disponible: todos
        (["codex", "gemini"], ("codex",)),  # el que ya no existe se ignora
        ([], ("claude", "codex")),
    ],
)
def test_the_effective_selection_is_a_subset_of_the_available_agents(
    saved: list[str] | None, expected: tuple[str, ...]
) -> None:
    assert effective_agents(saved, AVAILABLE) == expected
