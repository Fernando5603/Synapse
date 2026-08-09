import { normalizeName, type Node, type Proposal, type ProposedNode } from "@synapse/graph-core";

/**
 * El filtro determinista entre `sanitizeProposal` y `mergeProposal`.
 *
 * `sanitizeProposal` responde «¿esto cumple el esquema cerrado?»; esto responde «¿esto es
 * un nodo?». Son dos preguntas distintas y por eso son dos módulos: un `Claim` llamado
 * «thats not true» pasa el esquema entero y aun así no es una afirmación, es una arista
 * disfrazada de nodo.
 *
 * Todas las reglas son puras y de **precisión**: quitan o acortan nodos, nunca añaden.
 * Cada una está escrita contra los nodos que el modelo produjo de verdad en el banco, y
 * verificada de que no se lleva por delante ninguno de los que ya aciertan. La regla que
 * más se nota en una sala real —la 1 y la 2— no mueve el número del guion, porque el
 * guion es un debate redactado y una sala es gente escribiendo «that's not true».
 */

/**
 * Deícticos que no son nada por sí solos.
 *
 * Vienen de la sala, no del banco: el grafo de una conversación de cinco turnos tenía un
 * `Concept` llamado «you». Un nodo así no se funde con nada, no se puede volver a
 * mencionar y ensucia el render para siempre.
 */
const DEICTIC = new Set([
  "you",
  "i",
  "we",
  "they",
  "he",
  "she",
  "it",
  "that",
  "this",
  "these",
  "those",
  "there",
  "here",
  "one",
  "thing",
  "things",
  "stuff",
  "something",
  "anything",
  "everything",
  "someone",
  "everyone",
  "yes",
  "no",
  "ok",
  "okay",
  "true",
  "false",
  "right",
  "wrong",
]);

/**
 * Pronombres con los que arranca un acto de habla vacío.
 *
 * Van también las formas contraídas sin apóstrofo, porque es como escribe la gente en un
 * chat y porque el apóstrofo se cae al tokenizar: sin «thats» en esta lista, «that's not
 * true» —el nodo que motivó la regla— no la activaba.
 */
const OPENING_PRONOUN = new Set([
  "i",
  "you",
  "we",
  "they",
  "he",
  "she",
  "it",
  "that",
  "this",
  "those",
  "these",
  "im",
  "ive",
  "youre",
  "youve",
  "were",
  "weve",
  "theyre",
  "theyve",
  "hes",
  "shes",
  "its",
  "thats",
  "theres",
]);

/**
 * Verbos y adjetivos de pura valoración. Una frase construida **solo** con estos y un
 * pronombre no afirma nada sobre el mundo: dice qué le parece a alguien lo que dijo otro.
 */
const EVALUATIVE = new Set([
  "is",
  "are",
  "was",
  "were",
  "s",
  "re",
  "m",
  "not",
  "no",
  "nt",
  "dont",
  "doesnt",
  "isnt",
  "arent",
  "true",
  "false",
  "right",
  "wrong",
  "correct",
  "incorrect",
  "agree",
  "disagree",
  "exactly",
  "totally",
  "completely",
  "really",
  "quite",
  "very",
  "so",
  "too",
  "also",
  "sure",
  "think",
  "know",
  "guess",
  "mean",
  "with",
  "about",
  "at",
  "all",
]);

/** Los tipos que se redactan como frase; el resto es un sintagma nominal. */
const SENTENCE_TYPES = new Set(["Claim", "Evidence", "Decision", "Question"]);

/**
 * Un `Concept` es un sintagma nominal de 1 a 3 palabras. El prompt lo dice —«A Concept is
 * NEVER a full sentence»— y hasta ahora nadie lo comprobaba. El tope es 3 y no 4 porque
 * las 42 entidades del gold lo cumplen todas.
 */
const CONCEPT_MAX_WORDS = 3;

/**
 * Los tokens de identidad: los de `normalizeName`, que es con lo que el grafo decide si
 * dos nombres son el mismo nodo. Sirven para comparar nombres entre sí — la subsunción, el
 * tamaño de un `Concept`, los extremos de una arista— y para nada más.
 */
function words(name: string): string[] {
  return normalizeName(name)
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

/**
 * Los tokens **léxicos**: minúsculas y sin puntuación, pero sin singularizar.
 *
 * Las listas de arriba son de palabras concretas y `normalizeName` no las respeta: su
 * singularizador recorta la `-s` y la `-e` final, así que «this» llega como «thi» y
 * «true» como «tru», y ninguna casa con nada. Usarlo aquí fue el primer intento y las
 * dos reglas quedaron sin aplicarse jamás — silenciosamente, que es lo peor.
 */
function lexemes(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    .filter((word) => word.length > 0);
}

/** ¿Es un deíctico suelto, sin nada a lo que agarrarse? */
export function isDeictic(name: string): boolean {
  const tokens = lexemes(name);
  return tokens.length > 0 && tokens.every((word) => DEICTIC.has(word));
}

/**
 * ¿Es un acto de habla vacío — «thats not true», «i disagree», «you re wrong»?
 *
 * Arranca por pronombre y no queda ni un sustantivo de contenido detrás. Estas frases son
 * **aristas**: dicen que alguien contradice algo anterior, y convertirlas en nodo es
 * exactamente lo que deja el grafo sin relaciones y lleno de hojas sueltas.
 */
export function isEmptySpeechAct(name: string): boolean {
  const tokens = lexemes(name);
  if (tokens.length === 0 || tokens.length > 5) {
    return false;
  }
  if (!OPENING_PRONOUN.has(tokens[0]!)) {
    return false;
  }
  // Lo que sigue al pronombre tiene que ser todo cópula, negación o valoración: en cuanto
  // aparece una palabra de contenido («that model is wrong») ya hay algo que extraer.
  return tokens.slice(1).every((word) => EVALUATIVE.has(word) || DEICTIC.has(word));
}

/**
 * Recorta un nombre en la primera coma.
 *
 * Es la regla que más se defiende sola: el prompt ya pide una afirmación por nodo y hasta
 * diez palabras, y lo que el modelo devuelve son dos cláusulas cosidas —«eight second
 * timeout, one retry, carryover, and an ephemeral note»— que no casan con ninguna
 * entidad. La primera cláusula sí. No toca los `Concept`: un sintagma nominal no lleva
 * comas, y si las lleva es que la regla del tamaño ya lo va a rechazar.
 */
export function truncateAtComma(name: string): string {
  const comma = name.indexOf(",");
  if (comma === -1) {
    return name;
  }
  const head = name.slice(0, comma).trim();
  // Una coma en la primera o segunda palabra no separa cláusulas: recortar ahí dejaría un
  // nombre que no significa nada.
  return words(head).length >= 3 ? head : name;
}

interface Canonical {
  /** El nombre final, o `undefined` si el nodo se rechaza. */
  name: string | undefined;
}

function canonicalizeNode(node: ProposedNode, existing: ReadonlyMap<string, string>): Canonical {
  if (isDeictic(node.name)) {
    return { name: undefined };
  }

  if (!SENTENCE_TYPES.has(node.type)) {
    // Rama de sintagma nominal: `Concept` y `Person`.
    if (node.type === "Concept" && words(node.name).length > CONCEPT_MAX_WORDS) {
      return { name: undefined };
    }
    return { name: subsume(node, existing) };
  }

  if (isEmptySpeechAct(node.name)) {
    return { name: undefined };
  }
  return { name: truncateAtComma(node.name) };
}

/**
 * Subsunción: si los tokens de un `Concept` contienen estrictamente los de otro que **ya
 * está en el grafo**, se queda el que ya está.
 *
 * La dirección importa y es la única parte con riesgo. El gold prefiere el corto en unos
 * casos (`prompt`, `latency`) y el largo en otros (`hybrid pipeline`), así que la regla no
 * elige por longitud: elige el nombre que la sala ya está usando. Un nodo que no subsume a
 * ninguno existente se queda como está — nunca se funden dos nodos nuevos entre sí, porque
 * ahí no hay ningún criterio que no sea una corazonada.
 */
function subsume(node: ProposedNode, existing: ReadonlyMap<string, string>): string {
  if (node.type !== "Concept") {
    return node.name;
  }
  const tokens = new Set(words(node.name));
  for (const [key, name] of existing) {
    const other = key.split("|");
    if (other[0] !== "Concept") {
      continue;
    }
    const otherTokens = words(name);
    if (otherTokens.length >= tokens.size) {
      continue;
    }
    if (otherTokens.every((token) => tokens.has(token))) {
      return name;
    }
  }
  return node.name;
}

/**
 * Aplica el filtro a una propuesta.
 *
 * `existingNodes` son los nodos del grafo de la sala: la subsunción los necesita para
 * saber qué nombre ya está en uso. Las aristas se reescriben con el mismo mapa de nombres
 * —y se descartan las que apuntaban a un nodo rechazado—, porque `mergeProposal` resuelve
 * los extremos **por nombre** y una arista con el nombre viejo se caería en silencio.
 */
export function canonicalizeProposal(
  proposal: Proposal,
  existingNodes: readonly Node[] = [],
): Proposal {
  const existing = new Map<string, string>();
  for (const node of existingNodes) {
    existing.set(`${node.type}|${normalizeName(node.name)}`, node.name);
  }

  const renamed = new Map<string, string>();
  const nodes: ProposedNode[] = [];
  const emitted = new Set<string>();

  for (const node of proposal.nodes) {
    const { name } = canonicalizeNode(node, existing);
    if (name === undefined) {
      renamed.set(normalizeName(node.name), "");
      continue;
    }
    renamed.set(normalizeName(node.name), name);

    // Recortar y fundir hace que dos propuestas distintas acaben en el mismo nombre
    // («prompt quality» y «prompt»). `mergeProposal` lo toleraría, pero devolver el
    // duplicado haría que el delta anunciara un nodo que no se añade.
    const key = `${node.type}|${normalizeName(name)}`;
    if (emitted.has(key)) {
      continue;
    }
    emitted.add(key);
    nodes.push({ ...node, name });
    existing.set(key, name);
  }

  const edges = proposal.edges.flatMap((edge) => {
    // Un extremo que el filtro no tocó se deja como venía: puede referirse a un nodo que
    // ya estaba en el grafo y que esta propuesta no menciona.
    const from = renamed.get(normalizeName(edge.from)) ?? edge.from;
    const to = renamed.get(normalizeName(edge.to)) ?? edge.to;
    if (from === "" || to === "" || normalizeName(from) === normalizeName(to)) {
      return [];
    }
    return [{ ...edge, from, to }];
  });

  return { nodes, edges };
}
