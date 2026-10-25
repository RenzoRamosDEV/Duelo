import { useEffect, useState } from "react";
import type { Finding } from "../types";
import { agentLabel } from "../utils/agents";
import { copyText } from "../utils/clipboard";
import { findingFile, findingLine, isDangerSeverity, severityLabel } from "../utils/findings";
import { splitRecommendation } from "../utils/recommendation";
import { AgentTag } from "./AgentTag";
import { Collapsible, FINDING_LIMIT, isLong } from "./Collapsible";
import { Markdown } from "./Markdown";
import { Badge } from "./ui/Badge";

/** `archivo:línea` con un botón que lo copia; el resultado se anuncia como texto. */
function LocationChip({ text, label }: { text: string; label: string }) {
  const [result, setResult] = useState<"idle" | "ok" | "fail">("idle");
  useEffect(() => {
    if (result === "idle") return;
    const timer = setTimeout(() => setResult("idle"), 2000);
    return () => clearTimeout(timer);
  }, [result]);
  return (
    <span className="loc-chip">
      <span className="mono">{text}</span>
      <button
        type="button"
        className="loc-copy"
        aria-label={`Copiar ${label} ${text}`}
        title="Copiar ubicación"
        onClick={async () => setResult((await copyText(text)) ? "ok" : "fail")}
      >
        {result === "ok" ? "✓" : "⧉"}
      </button>
      <output className="visually-hidden">
        {result === "ok" ? "Copiado" : result === "fail" ? "No se pudo copiar" : ""}
      </output>
    </span>
  );
}

/**
 * Un hallazgo: severidad con etiqueta en texto, dónde está (`archivo:línea`, solo si tiene
 * archivo), el mensaje con un poco de formato y, si el texto lleva una etiqueta como `Arreglo:`,
 * el consejo aparte. `showFile` se apaga bajo un encabezado que ya nombra el archivo.
 */
export function FindingCard({
  id,
  finding,
  agent,
  showFile = true,
}: {
  id: string;
  finding: Finding;
  /** El agente que lo encontró, cuando se mezclan hallazgos de varios. */
  agent?: string;
  showFile?: boolean;
}) {
  const danger = isDangerSeverity(finding.severity);
  const file = findingFile(finding);
  const line = findingLine(finding);
  const { body, recommendation } = splitRecommendation(finding.message);
  const where = file ? (line ? `${file}:${line}` : file) : undefined;
  // Bajo un encabezado que nombra el archivo solo queda la línea, y solo si hay archivo.
  const location = showFile ? where : file && line ? `L${line}` : undefined;
  return (
    <div className="finding-card" data-danger={danger ? "" : undefined}>
      <header className="finding-head">
        <Badge tone={danger ? "alert" : "neutral"}>{severityLabel(finding.severity)}</Badge>
        {location && <LocationChip text={location} label={showFile ? "ubicación" : "línea"} />}
        {agent && (
          <span className="finding-agent">
            <AgentTag agent={agent} /> <span className="visually-hidden">{agentLabel(agent)}</span>
          </span>
        )}
      </header>
      {body && (
        <Collapsible id={`finding:${id}`} long={isLong(body, FINDING_LIMIT)}>
          <Markdown text={body} />
        </Collapsible>
      )}
      {recommendation && (
        <div className="finding-reco">
          <strong className="section-label">Arreglo sugerido</strong>
          <Markdown text={recommendation} />
        </div>
      )}
    </div>
  );
}
