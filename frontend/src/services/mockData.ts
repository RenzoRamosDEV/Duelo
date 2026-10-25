// Datos de ejemplo cuando no hay API configurada (VITE_API_URL).

import type { AgentStat, Health, MockProject } from "../types";

const DIFF = `@@ src/ingest.py
-    token = request.headers.get("X-Ingest-Token")
+    token = request.headers.get("X-Ingest-Token", "")
+    if not hmac.compare_digest(token, settings.ingest_token):
+        raise Unauthorized()
-    if token == settings.ingest_token:
-        return accept(request)`;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const projects: MockProject[] = [
  {
    slug: "duelo",
    name: "duelo",
    changes: [
      {
        id: "c1",
        kind: "commit",
        title: "fix: comparar el token de ingesta en tiempo constante",
        author: "renzo",
        sha: "a41f9c2",
        ref: "main",
        url: "https://github.com/RenzoRamosDEV/Duelo/commit/a41f9c2",
        createdAt: minutesAgo(12),
        diff: DIFF,
        reviews: [
          {
            id: "r1",
            agent: "claude",
            status: "completed",
            run: 1,
            durationMs: 42_000,
            score: 8,
            summary: "Cambio correcto; elimina la comparación vulnerable a timing.",
            findings: [
              {
                severity: "medium",
                file: "src/ingest.py",
                line: 3,
                message: "Falta test para token vacío. Arreglo: añade un caso con cabecera vacía.",
              },
              {
                severity: "low",
                file: "src/ingest.py",
                line: 1,
                message: "Considerar rotación del token.",
              },
            ],
          },
          { id: "r2", agent: "codex", status: "running" },
        ],
      },
      {
        // Un commit deshecho con `git reset`: ya no está en ninguna rama.
        id: "c3",
        kind: "commit",
        title: "fix: ajustar el límite de peticiones por IP",
        author: "marta",
        sha: "7c1d2e8",
        ref: "main",
        url: "https://github.com/RenzoRamosDEV/Duelo/commit/7c1d2e8",
        createdAt: minutesAgo(40),
        diff: DIFF,
        commitState: "discarded",
        reviews: [
          { id: "r5", agent: "claude", status: "completed", run: 1, durationMs: 31_000, score: 6 },
          { id: "r6", agent: "codex", status: "completed", run: 1, durationMs: 28_000, score: 7 },
        ],
      },
      {
        // Un commit que otro deshizo con `git revert`: sigue en la rama.
        id: "c4",
        kind: "commit",
        title: "feat: filtros del canal en el servidor",
        author: "renzo",
        sha: "b52e9a0",
        ref: "main",
        url: "https://github.com/RenzoRamosDEV/Duelo/commit/b52e9a0",
        createdAt: minutesAgo(90),
        diff: DIFF,
        commitState: "reverted",
        revertedBy: { id: "c5", sha: "d93f0b4" },
        reviews: [
          { id: "r7", agent: "claude", status: "completed", run: 1, durationMs: 40_000, score: 8 },
          { id: "r8", agent: "codex", status: "completed", run: 1, durationMs: 36_000, score: 9 },
        ],
      },
      {
        id: "c5",
        kind: "commit",
        title: 'Revert "feat: filtros del canal en el servidor"',
        author: "renzo",
        sha: "d93f0b4",
        ref: "main",
        url: "https://github.com/RenzoRamosDEV/Duelo/commit/d93f0b4",
        createdAt: minutesAgo(60),
        diff: DIFF,
        commitState: "active",
        reviews: [
          { id: "r9", agent: "claude", status: "completed", run: 1, durationMs: 22_000, score: 7 },
          { id: "r10", agent: "codex", status: "completed", run: 1, durationMs: 19_000, score: 7 },
        ],
      },
      {
        id: "c2",
        kind: "pr",
        title: "feat: exponer ingesta de commits",
        author: "renzo",
        sha: "9be03d1",
        ref: "feat/ingest-commits",
        url: "https://github.com/RenzoRamosDEV/Duelo/pull/7",
        createdAt: minutesAgo(3 * 60),
        diff: DIFF,
        truncated: true,
        reviews: [
          {
            id: "r3",
            agent: "claude",
            status: "completed",
            run: 1,
            durationMs: 38_000,
            score: 7,
            summary: "Buen aislamiento de puertos; revisar idempotencia.",
            findings: [
              {
                severity: "high",
                file: "src/ingest.py",
                line: 3,
                message: "Idempotency-Key no se valida en longitud.",
              },
            ],
          },
          {
            id: "r4",
            agent: "codex",
            status: "failed",
            run: 1,
            durationMs: 120_000,
            error: "Tiempo de espera agotado al llamar al modelo.",
          },
        ],
      },
    ],
  },
  { slug: "acme/widgets", name: "acme/widgets", changes: [] },
];

export const agentStats: AgentStat[] = [
  { agent: "claude", total: 12, completed: 11, failed: 1, avgDurationMs: 42_000, avgScore: 4.1 },
  { agent: "codex", total: 10, completed: 7, failed: 3, avgDurationMs: 35_000, avgScore: 3.8 },
];

export const health: Health = {
  status: "ok",
  dependencies: [
    { name: "postgres", status: "ok", latencyMs: 4 },
    { name: "temporal", status: "ok", latencyMs: 12 },
  ],
  agentNames: ["claude", "codex"],
};
