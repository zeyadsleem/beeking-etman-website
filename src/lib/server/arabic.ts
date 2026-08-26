/**
 * Arabic search normalization shared by the application query path and the
 * FTS5 index triggers (via `ftsNormalizeSqlExpr`). Both sides of every match
 * MUST apply the exact same folding or index/query tokens diverge silently.
 *
 * Rules:
 * - strip harakat/diacritics U+064B–U+0655, dagger alif U+0670, tatweel U+0640
 * - unify alef forms أ إ آ ٱ -> ا
 * - taa marbuta ة -> ه
 * - alef maqsura ى -> ي
 *
 * Hamza-carrier letters (ؤ ئ) stay distinct: folding them changes word
 * identity more often than it helps recall.
 */

const DIACRITICS_RE = /[\u064B-\u0655\u0640\u0670]/g;

const ALEF = "\u0627";
const ALEF_FORMS = ["\u0623", "\u0625", "\u0622", "\u0671"] as const;
const TAA_MARBUTA = "\u0629";
const HEH = "\u0647";
const ALEF_MAQSURA = "\u0649";
const YEH = "\u064A";

export function normalizeArabic(input: string): string {
  let out = input.replace(DIACRITICS_RE, "");
  for (const form of ALEF_FORMS) out = out.split(form).join(ALEF);
  out = out.split(TAA_MARBUTA).join(HEH);
  return out.split(ALEF_MAQSURA).join(YEH);
}

/**
 * Pure-SQL mirror of `normalizeArabic` as a nested REPLACE chain over a raw
 * column reference (e.g. `new.name` or `"store_category"."name"`). D1 has no
 * user-defined functions, so the FTS triggers embed this expression directly;
 * `arabic.spec.ts` proves the migration file and this generator never drift.
 */
export function ftsNormalizeSqlExpr(columnRef: string): string {
  const steps: Array<[string, string]> = [];
  for (let cp = 0x064b; cp <= 0x0655; cp += 1) steps.push([String.fromCodePoint(cp), ""]);
  steps.push(["\u0640", ""], ["\u0670", ""]);
  for (const form of ALEF_FORMS) steps.push([form, ALEF]);
  steps.push([TAA_MARBUTA, HEH], [ALEF_MAQSURA, YEH]);
  return steps.reduceRight<[string, string]>(
    (expr, [from, to]) => [`REPLACE(${expr[0]}, '${from}', '${to}')`, to],
    [columnRef, ""],
  )[0];
}
