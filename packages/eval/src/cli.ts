import { readFileSync } from "node:fs";
import type { EntityType, Graph } from "@synapse/graph-core";
import { evalEntities, evalRelations } from "./matching.js";
import type { EvalReport, Gold } from "./types.js";

export interface CliArgs {
  goldPath: string;
  graphPath: string;
  types: EntityType[];
}

export function parseArgs(argv: string[]): CliArgs | null {
  let goldPath: string | null = null;
  let graphPath: string | null = null;
  let types: EntityType[] | null = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--types" || arg === "--type") {
      const value = argv[i + 1];
      if (value !== undefined) {
        types = value.split(",").filter((t) => t !== "") as EntityType[];
        i += 1;
      }
    } else if (arg === "--gold") {
      const value = argv[i + 1];
      if (value !== undefined) {
        goldPath = value;
        i += 1;
      }
    } else if (arg === "--graph") {
      const value = argv[i + 1];
      if (value !== undefined) {
        graphPath = value;
        i += 1;
      }
    }
  }

  if (goldPath === null || graphPath === null || types === null) {
    return null;
  }
  return { goldPath, graphPath, types };
}

export function loadGold(path: string): Gold {
  return JSON.parse(readFileSync(path, "utf8")) as Gold;
}

export function loadGraph(path: string): Graph {
  return JSON.parse(readFileSync(path, "utf8")) as Graph;
}

function fmt(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function renderReport(report: EvalReport): string {
  const lines: string[] = [];
  lines.push("Precisión / recall contra el gold");
  lines.push("");

  lines.push(`Entidades (con tipo):  P=${fmt(report.entities.withType.precision)}  R=${fmt(report.entities.withType.recall)}  (${report.entities.withType.hits}/${report.entities.withType.goldSize})`);
  lines.push(`Entidades (sin tipo):  P=${fmt(report.entities.withoutType.precision)}  R=${fmt(report.entities.withoutType.recall)}  (${report.entities.withoutType.hits}/${report.entities.withoutType.goldSize})`);
  lines.push("");
  lines.push(`Relaciones (con tipo): P=${fmt(report.relations.withType.precision)}  (${report.relations.withType.hits}/${report.relations.withType.goldSize})`);
  lines.push(`Relaciones (sin tipo): P=${fmt(report.relations.withoutType.precision)}  (${report.relations.withoutType.hits}/${report.relations.withoutType.goldSize})`);
  lines.push("");

  // El umbral del criterio (b): ≥60% precisión y ≥50% recall en entidades, ≥50% en relaciones.
  const e = report.entities.withType;
  const r = report.relations.withType;
  const pass =
    e.precision >= 0.6 && e.recall >= 0.5 && r.precision >= 0.5;
  lines.push(pass ? "Criterio (b): VERDE" : "Criterio (b): NO VERDE");

  return lines.join("\n");
}

export function run(args: CliArgs): EvalReport {
  const gold = loadGold(args.goldPath);
  const graph = loadGraph(args.graphPath);
  const types = args.types;

  return {
    entities: evalEntities({ gold, extracted: graph, types }),
    relations: evalRelations({ gold, extracted: graph, types }),
  };
}

