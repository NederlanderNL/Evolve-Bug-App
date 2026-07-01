function tokenize(text) {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2) // drop tiny/noise words
  );
}

// Jaccard similarity (0 = no overlap, 1 = identical word sets) over the
// combined title + description of two bugs. Cheap, no dependencies, good
// enough to catch near-duplicate reports without false-positiving on
// short/generic titles too aggressively.
export function bugSimilarity(a, b) {
  const setA = tokenize(`${a.title} ${a.description || ""}`);
  const setB = tokenize(`${b.title} ${b.description || ""}`);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Threshold above which two reports are treated as the same bug. Tuned to
// be reasonably cautious — adjust here if it's too eager/lax in practice.
export const DUPLICATE_THRESHOLD = 0.45;

export function isDuplicate(candidate, existingBugs) {
  return existingBugs.some((b) => bugSimilarity(candidate, b) >= DUPLICATE_THRESHOLD);
}

// Returns the best-matching existing entry and its similarity score, or
// null if nothing crosses the threshold. Used to show staff exactly what
// the duplicate detection matched against.
export function findDuplicate(candidate, existingBugs) {
  let best = null;
  let bestScore = 0;
  for (const b of existingBugs) {
    const score = bugSimilarity(candidate, b);
    if (score >= DUPLICATE_THRESHOLD && score > bestScore) {
      best = b;
      bestScore = score;
    }
  }
  return best ? { match: best, score: bestScore } : null;
}
