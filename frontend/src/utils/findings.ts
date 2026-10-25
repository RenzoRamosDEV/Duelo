import type { AgentName, Finding, Review } from "../types";

export interface GroupedFinding extends Finding {
  agent: AgentName;
  key: string;
}

export interface FindingGroup {
  /** `undefined` agrupa los hallazgos que el agente no pudo situar en un archivo. */
  file: string | undefined;
  findings: GroupedFinding[];
}

/** De más a menos grave; incluye las palabras del backend (`bug`, `risk`, `improvement`, `nit`). */
const SEVERITY_ORDER = [
  "critical",
  "bug",
  "high",
  "risk",
  "medium",
  "improvement",
  "low",
  "info",
  "nit",
];

/** Las severidades desconocidas (texto libre en el backend) van después de las conocidas. */
export function severityRank(severity: string): number {
  const rank = SEVERITY_ORDER.indexOf(severity.toLowerCase());
  return rank === -1 ? SEVERITY_ORDER.length : rank;
}

const DANGER = new Set(["critical", "bug", "high"]);
const WARNING = new Set(["risk", "medium"]);
const INFO = new Set(["improvement", "low", "info"]);

export type SeverityTone = "err" | "warn" | "info" | "neutral";

/** Rojo para lo que rompe, ámbar para lo que puede, azul para mejoras, neutro para el resto. */
export function severityTone(severity: string): SeverityTone {
  const name = severity.toLowerCase();
  if (DANGER.has(name)) return "err";
  if (WARNING.has(name)) return "warn";
  return INFO.has(name) ? "info" : "neutral";
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: "Crítico",
  bug: "Bug",
  high: "Alto",
  risk: "Riesgo",
  medium: "Medio",
  improvement: "Mejora",
  low: "Bajo",
  info: "Info",
  nit: "Detalle",
};

/** Nombre en español de una severidad; una desconocida se muestra como la escribió el agente. */
export function severityLabel(severity: string): string {
  const name = severity.trim();
  return (
    SEVERITY_LABEL[name.toLowerCase()] ??
    (name ? name.charAt(0).toUpperCase() + name.slice(1) : "—")
  );
}

/** El backend (y algunos agentes) envían `N/A` o vacío cuando no hay archivo. */
export function findingFile(finding: Pick<Finding, "file">): string | undefined {
  const file = finding.file?.trim();
  return !file || file.toUpperCase() === "N/A" ? undefined : file;
}

/** La línea solo se muestra si es un entero positivo (`0` significa desconocida). */
export function findingLine(finding: Pick<Finding, "line">): number | undefined {
  return Number.isInteger(finding.line) && finding.line > 0 ? finding.line : undefined;
}

/**
 * Agrupa los hallazgos de todas las reviews por archivo; el más grave primero y luego por línea
 * (sin línea al final). Los archivos van alfabéticamente y el grupo sin archivo siempre al final.
 */
export function groupFindings(reviews: Review[]): FindingGroup[] {
  const byFile = new Map<string | undefined, GroupedFinding[]>();
  for (const review of reviews) {
    (review.findings ?? []).forEach((finding, index) => {
      const file = findingFile(finding);
      const list = byFile.get(file) ?? [];
      list.push({ ...finding, agent: review.agent, key: `${review.id}-${index}` });
      byFile.set(file, list);
    });
  }
  return [...byFile.entries()]
    .map(([file, findings]) => ({
      file,
      findings: findings.sort(
        (a, b) =>
          severityRank(a.severity) - severityRank(b.severity) ||
          (findingLine(a) ?? Number.POSITIVE_INFINITY) -
            (findingLine(b) ?? Number.POSITIVE_INFINITY),
      ),
    }))
    .sort((a, b) => {
      if (a.file === undefined || b.file === undefined) {
        return Number(a.file === undefined) - Number(b.file === undefined);
      }
      return a.file.localeCompare(b.file);
    });
}
