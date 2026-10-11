"""Carpeta de agente: frontmatter, carga con errores que nombran la ruta y selección de skills."""

from __future__ import annotations

from pathlib import Path

import pytest

from duelo.adapters.agents.agent_folder import (
    AGENT_FILE,
    SKILL_FILE,
    SKILLS_DIR,
    AgentDefinition,
    load_agent,
    parse_frontmatter,
)

AGENT_TEXT = """---
name: guardian
version: 7
skills:
  - core
  - report
---

Cuerpo del agente con {mark}.
"""


def _skill(root: Path, name: str, *, paths: tuple[str, ...] = (), body: str = "texto") -> None:
    directory = root / SKILLS_DIR / name
    directory.mkdir(parents=True)
    lines = [f"name: {name}", f"description: Skill {name}"]
    if paths:
        lines.append("paths:")
        lines.extend(f'  - "{pattern}"' for pattern in paths)
    (directory / SKILL_FILE).write_text(
        "---\n" + "\n".join(lines) + "\n---\n\n" + body + "\n", encoding="utf-8"
    )


@pytest.fixture
def agent_root(tmp_path: Path) -> Path:
    root = tmp_path / "guardian"
    root.mkdir()
    (root / AGENT_FILE).write_text(AGENT_TEXT, encoding="utf-8")
    _skill(root, "core")
    _skill(root, "report")
    _skill(root, "frontend", paths=("*.tsx", "*.css"))
    _skill(root, "temporal", paths=("*workflows/*",))
    _skill(root, "dormant")  # sin paths y sin declarar: nunca entra
    return root


# --- frontmatter -------------------------------------------------------------------------------


def test_frontmatter_reads_scalars_lists_and_quoted_values(tmp_path: Path) -> None:
    text = (
        "---\nname: x\ndescription: con: dos puntos\n"
        "paths:\n  - \"*.py\"\n  - '*.md'\n---\n\nhola\n"
    )

    meta, body = parse_frontmatter(text, tmp_path / "f.md")

    assert meta == {"name": "x", "description": "con: dos puntos", "paths": ["*.py", "*.md"]}
    assert body == "hola\n"


@pytest.mark.parametrize(
    "text",
    [
        "sin frontmatter\n",
        "---\nname: x\n",  # sin cerrar
        "---\n  - suelto\n---\n",  # lista sin clave
        "---\nsin separador\n---\n",
    ],
)
def test_frontmatter_outside_the_subset_fails_naming_the_file(tmp_path: Path, text: str) -> None:
    path = tmp_path / "roto.md"

    with pytest.raises(ValueError, match=str(path)):
        parse_frontmatter(text, path)


# --- carga ---------------------------------------------------------------------------------------


def test_the_agent_loads_its_version_body_and_every_skill(agent_root: Path) -> None:
    agent = load_agent(agent_root)

    assert (agent.name, agent.version) == ("guardian", 7)
    assert agent.body.startswith("Cuerpo del agente con {mark}.")
    assert agent.always == ("core", "report")
    assert set(agent.skills) == {"core", "report", "frontend", "temporal", "dormant"}
    assert agent.skills["frontend"].paths == ("*.tsx", "*.css")
    assert agent.skills["frontend"].description == "Skill frontend"


def test_a_missing_agent_file_fails_naming_the_path(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError, match=str(tmp_path / AGENT_FILE)):
        load_agent(tmp_path)


def test_a_declared_skill_without_file_fails_naming_its_path(tmp_path: Path) -> None:
    (tmp_path / AGENT_FILE).write_text(AGENT_TEXT, encoding="utf-8")
    _skill(tmp_path, "core")
    expected = tmp_path / SKILLS_DIR / "report" / SKILL_FILE

    with pytest.raises(FileNotFoundError, match=str(expected)):
        load_agent(tmp_path)


@pytest.mark.parametrize(
    ("text", "problem"),
    [
        (AGENT_TEXT.replace("{mark}", "sin marca"), "{mark}"),
        (AGENT_TEXT.replace("version: 7", "version: tres"), "version"),
    ],
)
def test_an_agent_without_mark_or_integer_version_fails(
    tmp_path: Path, text: str, problem: str
) -> None:
    (tmp_path / AGENT_FILE).write_text(text, encoding="utf-8")
    _skill(tmp_path, "core")
    _skill(tmp_path, "report")

    with pytest.raises(ValueError, match=problem) as info:
        load_agent(tmp_path)
    assert str(tmp_path / AGENT_FILE) in str(info.value)


def test_a_skill_whose_name_differs_from_its_folder_fails(tmp_path: Path) -> None:
    (tmp_path / AGENT_FILE).write_text(AGENT_TEXT, encoding="utf-8")
    _skill(tmp_path, "core")
    _skill(tmp_path, "report")
    (tmp_path / SKILLS_DIR / "report" / SKILL_FILE).write_text(
        "---\nname: otro\n---\n\nx\n", encoding="utf-8"
    )

    with pytest.raises(ValueError, match="no coincide con la carpeta"):
        load_agent(tmp_path)


# --- selección -----------------------------------------------------------------------------------


def _names(agent: AgentDefinition, files: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(skill.name for skill in agent.select_skills(files))


def test_without_files_only_the_always_on_skills_enter_in_declared_order(agent_root: Path) -> None:
    assert _names(load_agent(agent_root), ()) == ("core", "report")


def test_a_matching_path_adds_its_skill_after_the_always_on_ones(agent_root: Path) -> None:
    agent = load_agent(agent_root)

    assert _names(agent, ("frontend/src/App.tsx",)) == ("core", "report", "frontend")
    assert _names(agent, ("backend/src/duelo/workflows/a.py",)) == ("core", "report", "temporal")
    assert _names(agent, ("README.md",)) == ("core", "report")


def test_conditional_skills_come_in_alphabetical_order_without_duplicates(
    agent_root: Path,
) -> None:
    agent = load_agent(agent_root)
    files = ("x/workflows/a.py", "ui/a.tsx", "ui/b.css", "y/workflows/b.py")

    assert _names(agent, files) == ("core", "report", "frontend", "temporal")


def test_an_always_on_skill_with_paths_is_not_duplicated(tmp_path: Path) -> None:
    (tmp_path / AGENT_FILE).write_text(AGENT_TEXT, encoding="utf-8")
    _skill(tmp_path, "core", paths=("*.py",))
    _skill(tmp_path, "report")

    assert _names(load_agent(tmp_path), ("a.py",)) == ("core", "report")
