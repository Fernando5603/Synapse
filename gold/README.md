# Gold — anotación de referencia

El material de evaluación del criterio (b) de `goal.md`. El guion y la anotación
viven versionados en `gold/`. La congelación definitiva (no tocar más aunque duela
ver los fallos) la decide el equipo a mano tras la revisión — hasta entonces el
gold puede corregirse.

## Archivos

- `debate.md` — el guion, un turno por bloque `HABLANTE: texto`.
- `gold.json` — la anotación con el esquema cerrado.

## Formato de `gold.json`

```json
{
  "schemaVersion": 1,
  "language": "en",
  "entityTypes": ["Claim", "Concept", "Question", "Evidence", "Person", "Decision"],
  "relationTypes": ["SUPPORTS", "CONTRADICTS", "ELABORATES", "ANSWERS", "PROPOSED_BY", "RESOLVES"],

  "turns": [
    { "n": 1, "speaker": "Ana", "text": "..." }
  ],

  "entities": [
    {
      "id": "e1",
      "type": "Concept",
      "name": "debounce window",
      "aliases": ["the debounce", "three second window", "batching delay"],
      "firstTurn": 1
    }
  ],

  "relations": [
    { "type": "CONTRADICTS", "from": "e2", "to": "e1", "turn": 2 },
    { "type": "PROPOSED_BY", "from": "e2", "to": "e3", "turn": 2 }
  ]
}
```

## Reglas

- `entityTypes` y `relationTypes` están **congelados**: los 6+6 del spec. No inventar.
- El `name` es el nombre canónico de la entidad.
- Cada `alias` tiene que aparecer **literalmente** en el texto del guion (la regla de
  matching del script de evaluación iguala contra ellos), sin distinguir mayúsculas:
  el texto del debate usa `Decision`/`CONTRADICTS` en mayúsculas y el evaluador
  normaliza a minúsculas. El `name` también puede aparecer, pero no es obligatorio.
- Una `Question` sin ninguna arista `ANSWERS` es deliberado: queda abierta.
- Cada entidad gold se consume una sola vez al evaluar (ver `spec.md` → Evaluación).
