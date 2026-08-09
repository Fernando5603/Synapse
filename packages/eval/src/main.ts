import { parseArgs, renderReport, run, type CliArgs } from "./cli.js";

const [_node, _script, ...argv] = process.argv;
const args: CliArgs | null = parseArgs(argv);
if (args !== null) {
  console.log(renderReport(run(args)));
} else {
  console.error(
    "Uso: tsx src/main.ts --gold <gold.json> --graph <graph.json> --types Claim,Concept,Question,Evidence,Person,Decision",
  );
  process.exit(1);
}
