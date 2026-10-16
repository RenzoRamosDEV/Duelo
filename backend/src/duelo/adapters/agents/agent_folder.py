"""Carpeta de agente: `Agents/<nombre>/AGENT.md` más `skills/<skill>/SKILL.md` dentro del agente.

El producto compone el prompt a partir de ella (los CLI no cargan skills por su cuenta). Lógica
pura sobre ficheros de texto: no lanza nada.

Frontmatter: un bloque `---` … `---` al principio del fichero con `clave: valor` y listas de
`- item`. Es un subconjunto cerrado (sin anidamiento ni escapes); una sintaxis fuera de él falla
nombrando el fichero. Del agente se leen `name`, `version` (entero) y `skills` (siempre activas);
de cada skill, `name`, `description` y `paths` (globs de `fnmatch` sobre la ruta completa del
fichero en el diff, donde `*` también cruza directorios)."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from fnmatch import fnmatchcase
from functools import cache
from pathlib import Path

AGENT_FILE = "AGENT.md"
SKILLS_DIR = "skills"
SKILL_FILE = "SKILL.md"
# Marca que el cuerpo del agente debe llevar: se sustituye por el identificador aleatorio de
# cada ejecución al delimitar los datos no confiables.
MARK = "{mark}"

_FENCE = "---"
_LIST_ITEM = "- "


@dataclass(frozen=True, slots=True)
class Skill:
    name: str
    description: str
    paths: tuple[str, ...]
    body: str

    def matches(self, files: Iterable[str]) -> bool:
        return any(fnmatchcase(file, pattern) for file in files for pattern in self.paths)


@dataclass(frozen=True, slots=True)
class AgentDefinition:
    name: str
    version: int
    body: str
    always: tuple[str, ...]
    skills: Mapping[str, Skill]

    def select_skills(self, files: Iterable[str]) -> tuple[Skill, ...]:
        """Siempre activas en el orden declarado y, después, las condicionales cuyos `paths`
        casan con algún fichero, en orden alfabético; sin duplicados."""
        paths = tuple(files)
        chosen = [self.skills[name] for name in self.always]
        conditional = sorted(
            (
                skill
                for name, skill in self.skills.items()
                if name not in self.always and skill.paths and skill.matches(paths)
            ),
            key=lambda skill: skill.name,
        )
        return (*chosen, *conditional)


def _unquote(value: str) -> str:
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        return value[1:-1]
    return value


def parse_frontmatter(text: str, path: Path) -> tuple[dict[str, str | list[str]], str]:
    """Separa el frontmatter del cuerpo. Devuelve (metadatos, cuerpo)."""
    lines = text.split("\n")  # conserva el salto final del cuerpo
    if not lines or lines[0].strip() != _FENCE:
        raise ValueError(f"{path}: falta el frontmatter (bloque --- al principio)")
    meta: dict[str, str | list[str]] = {}
    current_list: list[str] | None = None
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == _FENCE:
            return meta, "\n".join(lines[index + 1 :]).lstrip("\n")
        if not line.strip():
            continue
        stripped = line.strip()
        if stripped.startswith(_LIST_ITEM):
            if current_list is None:
                raise ValueError(f"{path}: elemento de lista sin clave en la línea {index + 1}")
            current_list.append(_unquote(stripped.removeprefix(_LIST_ITEM).strip()))
            continue
        if line[0].isspace():
            raise ValueError(f"{path}: sangría inesperada en la línea {index + 1}")
        key, separator, value = line.partition(":")
        if not separator or not key.strip():
            raise ValueError(f"{path}: línea {index + 1} no es `clave: valor`")
        if value.strip():
            meta[key.strip()] = _unquote(value.strip())
            current_list = None
        else:
            current_list = []
            meta[key.strip()] = current_list
    raise ValueError(f"{path}: frontmatter sin cerrar")


def _text(meta: Mapping[str, str | list[str]], key: str, path: Path, default: str) -> str:
    value = meta.get(key, default)
    if not isinstance(value, str):
        raise ValueError(f"{path}: `{key}` debe ser texto")  # noqa: TRY004 - contrato: ValueError con la ruta
    return value


def _list(meta: Mapping[str, str | list[str]], key: str, path: Path) -> tuple[str, ...]:
    value = meta.get(key, [])
    if not isinstance(value, list):
        raise ValueError(f"{path}: `{key}` debe ser una lista")  # noqa: TRY004 - contrato: ValueError con la ruta
    return tuple(value)


def _read(path: Path, what: str) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"No existe {what}: {path}") from exc


def load_skill(directory: Path) -> Skill:
    path = directory / SKILL_FILE
    meta, body = parse_frontmatter(_read(path, "la skill"), path)
    name = _text(meta, "name", path, directory.name)
    if name != directory.name:
        raise ValueError(f"{path}: `name` ({name}) no coincide con la carpeta ({directory.name})")
    return Skill(
        name=name,
        description=_text(meta, "description", path, ""),
        paths=_list(meta, "paths", path),
        body=body,
    )


@cache
def load_agent(root: Path) -> AgentDefinition:
    """Lee `AGENT.md` y todas las skills de `skills/`. Cacheada por carpeta: el worker la lee
    una vez por proceso. Falla con `FileNotFoundError` (ruta) si falta el agente o una skill
    declarada, y con `ValueError` (ruta) si el frontmatter o el cuerpo no cumplen el contrato."""
    agent_path = root / AGENT_FILE
    meta, body = parse_frontmatter(_read(agent_path, "el agente"), agent_path)
    raw_version = _text(meta, "version", agent_path, "")
    if not raw_version.isdigit():
        raise ValueError(f"{agent_path}: `version` debe ser un entero (es {raw_version!r})")
    if MARK not in body:
        raise ValueError(f"{agent_path}: el cuerpo debe contener la marca {MARK}")
    always = _list(meta, "skills", agent_path)
    skills_dir = root / SKILLS_DIR
    skills: dict[str, Skill] = {}
    for name in always:
        skills[name] = load_skill(skills_dir / name)
    if skills_dir.is_dir():
        for directory in sorted(skills_dir.iterdir()):
            if directory.is_dir() and directory.name not in skills:
                skills[directory.name] = load_skill(directory)
    return AgentDefinition(
        name=_text(meta, "name", agent_path, root.name),
        version=int(raw_version),
        body=body,
        always=always,
        skills=skills,
    )
