// The Elastic Brain: a consolidation sweep over the working memory that
//   • FOLDS near-duplicates into one durable fact,
//   • PROMOTES memories that get re-confirmed (strength up, verified),
//   • DECAYS memories with disuse (strength fades over time),
//   • PRUNES noise and faded-and-stale memories,
// emitting an auditable diff you can inspect before applying.

export type MemRow = {
  id: string;
  text: string;
  tag: string;
  createdAt: number;
  strength: number; // 0..1
  uses: number;
  verified: boolean;
  lastUsed: number | null; // ms
};

export type Updated = { id: string; strength: number; uses: number; verified: boolean };

export type ConsolidationDiff = {
  keep: MemRow[];
  folded: { keep: MemRow; drop: MemRow[] }[]; // near-duplicates merged into `keep`
  pruned: MemRow[]; // noise + faded-and-stale removed
  updates: Updated[]; // new strength/uses/verified to persist for survivors
  promoted: number; // survivors whose strength rose (re-confirmed)
  faded: number; // survivors that slipped into the weak tier
};

const norm = (t: string) => t.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
const tokens = (t: string) => new Set(norm(t).split(" ").filter((w) => w.length > 2));

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const NOISE = /^(ok|okay|hi|hey|hello|thanks?|yes|no|sure|test(ing)?|nvm|lol)\b/i;
const SIMILAR = 0.62; // token-overlap threshold to treat two memories as the same
const HALF_LIFE_DAYS = 45; // strength halves after this long unused
const DAY = 86_400_000;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export const TIER = (s: number): "durable" | "active" | "faded" =>
  s >= 0.66 ? "durable" : s >= 0.33 ? "active" : "faded";

// time decay toward zero based on how long since the memory was last used
function decayed(m: MemRow, now: number): number {
  const since = (now - (m.lastUsed ?? m.createdAt)) / DAY;
  if (since <= 0) return m.strength;
  return clamp(m.strength * Math.pow(0.5, since / HALF_LIFE_DAYS));
}

export function consolidate(rows: MemRow[], now: number): ConsolidationDiff {
  // newest first → the surviving representative of a duplicate group is the freshest
  const sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt);

  // 1) prune obvious noise up front
  const pruned: MemRow[] = [];
  const survivors: MemRow[] = [];
  for (const r of sorted) {
    const t = r.text.trim();
    if (t.length < 8 || NOISE.test(t) || tokens(t).size < 2) pruned.push(r);
    else survivors.push(r);
  }

  // 2) fold near-duplicates; each confirmation promotes the survivor
  const keep: MemRow[] = [];
  const folded: { keep: MemRow; drop: MemRow[] }[] = [];
  const updates: Updated[] = [];
  const used = new Set<string>();
  let promoted = 0;
  let faded = 0;

  for (let i = 0; i < survivors.length; i++) {
    if (used.has(survivors[i].id)) continue;
    const rep = survivors[i];
    const repTokens = tokens(rep.text);
    const drop: MemRow[] = [];
    for (let j = i + 1; j < survivors.length; j++) {
      const other = survivors[j];
      if (used.has(other.id)) continue;
      if (norm(rep.text) === norm(other.text) || jaccard(repTokens, tokens(other.text)) >= SIMILAR) {
        drop.push(other);
        used.add(other.id);
      }
    }
    used.add(rep.id);

    // base = time-decayed strength; each fold is a re-confirmation → promote
    const base = decayed(rep, now);
    const confirmations = drop.length;
    const nextStrength = clamp(base + (confirmations > 0 ? 0.18 * (confirmations + 1) : 0));
    const nextUses = rep.uses + confirmations;
    const nextVerified = rep.verified || confirmations > 0;

    if (nextStrength > rep.strength + 0.001) promoted++;
    if (TIER(nextStrength) === "faded" && TIER(rep.strength) !== "faded") faded++;

    const updatedRep: MemRow = { ...rep, strength: nextStrength, uses: nextUses, verified: nextVerified };
    keep.push(updatedRep);
    updates.push({ id: rep.id, strength: nextStrength, uses: nextUses, verified: nextVerified });
    if (drop.length) folded.push({ keep: updatedRep, drop });
  }

  // 3) prune what has fully faded AND gone stale (weak + untouched for a while)
  const stillKept: MemRow[] = [];
  for (const m of keep) {
    const stale = (now - (m.lastUsed ?? m.createdAt)) / DAY > 21;
    if (m.strength < 0.15 && stale && !m.verified) pruned.push(m);
    else stillKept.push(m);
  }

  return { keep: stillKept, folded, pruned, updates, promoted, faded };
}

// ids a sweep removes (folded-away duplicates + pruned noise/faded)
export function idsToRemove(diff: ConsolidationDiff): string[] {
  return [...diff.folded.flatMap((g) => g.drop), ...diff.pruned].map((m) => m.id);
}
