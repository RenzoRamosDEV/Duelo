"""Puertos de la capa de aplicación, un módulo por capacidad.

Los adaptadores los implementan y los casos de uso los reciben; este paquete reexporta todos los
nombres para que `from duelo.application.ports import X` siga siendo el camino público.
"""

from __future__ import annotations

from duelo.application.ports.changes import (
    ChangeEventRepository,
    ChangeRepository,
    CommitWithReviews,
)
from duelo.application.ports.git import (
    CommitMarks,
    GitRepository,
    HistoryUnavailable,
    HookInstaller,
    HookInstallError,
    InvalidRepository,
    RepoInfo,
    RepositoryHistory,
)
from duelo.application.ports.github import (
    GithubPrSource,
    GithubUnavailable,
    PullRequestInfo,
)
from duelo.application.ports.orchestration import (
    ReviewStarter,
    ReviewStartError,
)
from duelo.application.ports.projects import (
    ProjectAgents,
    ProjectAlreadyExists,
    ProjectCatalog,
    ProjectPaths,
    ProjectRepository,
    ProjectSlugs,
)
from duelo.application.ports.rate_limit import (
    RateLimitDecision,
    RateLimiter,
)
from duelo.application.ports.reviews import (
    ArchiveOutcome,
    ReviewAgent,
    ReviewArchive,
    ReviewRepository,
)

__all__ = [
    "ArchiveOutcome",
    "ChangeEventRepository",
    "ChangeRepository",
    "CommitMarks",
    "CommitWithReviews",
    "GitRepository",
    "GithubPrSource",
    "GithubUnavailable",
    "HistoryUnavailable",
    "HookInstallError",
    "HookInstaller",
    "InvalidRepository",
    "ProjectAgents",
    "ProjectAlreadyExists",
    "ProjectCatalog",
    "ProjectPaths",
    "ProjectRepository",
    "ProjectSlugs",
    "PullRequestInfo",
    "RateLimitDecision",
    "RateLimiter",
    "RepoInfo",
    "RepositoryHistory",
    "ReviewAgent",
    "ReviewArchive",
    "ReviewRepository",
    "ReviewStartError",
    "ReviewStarter",
]
