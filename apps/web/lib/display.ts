export interface Participant {
  id: string;
  anon: boolean;
  username?: string;
  metadata?: Record<string, unknown>;
}

export interface Me {
  id: string;
  anon: boolean;
}

export interface Sender {
  id: string;
  anon: boolean;
}

export interface RosterRow {
  id: string;
  displayName: string;
  isMe: boolean;
}

const EMPTY_NAMES: ReadonlyMap<string, string> = new Map();

function anonLabel(id: string): string {
  return `anon-${id.slice(0, 4)}`;
}

function displayNameOf(participant: Participant): string {
  const fromMetadata = participant.metadata?.displayName;
  if (typeof fromMetadata === "string" && fromMetadata.trim() !== "") {
    return fromMetadata;
  }
  if (participant.username !== undefined && participant.username !== "") {
    return participant.username;
  }
  return anonLabel(participant.id);
}

export interface PresenceLike {
  kind: "detailed" | "aggregate";
  participants?: Participant[];
}

export function detailedParticipants(
  presence: PresenceLike | undefined,
): Participant[] {
  return presence !== undefined && presence.kind === "detailed"
    ? (presence.participants ?? [])
    : [];
}

export function resolveDisplayName(
  sender: Sender,
  me: Me | undefined,
  participants: readonly Participant[],
  knownNames: ReadonlyMap<string, string> = EMPTY_NAMES,
): string {
  const match = participants.find((p) => p.id === sender.id);
  if (match !== undefined) {
    return displayNameOf(match);
  }
  const known = knownNames.get(sender.id);
  if (known !== undefined) {
    return known;
  }
  if (me !== undefined && sender.id === me.id) {
    return "yo";
  }
  return anonLabel(sender.id);
}

export function buildRoster(
  me: Me | undefined,
  participants: readonly Participant[],
): RosterRow[] {
  const self =
    me !== undefined ? participants.find((p) => p.id === me.id) : undefined;
  const others = participants.filter((p) => p.id !== me?.id);

  const selfRow: RosterRow | undefined =
    self !== undefined
      ? { id: self.id, displayName: displayNameOf(self), isMe: true }
      : me !== undefined
        ? { id: me.id, displayName: "yo", isMe: true }
        : undefined;

  const otherRows = others
    .map((p) => ({ id: p.id, displayName: displayNameOf(p), isMe: false }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return selfRow === undefined ? otherRows : [selfRow, ...otherRows];
}
