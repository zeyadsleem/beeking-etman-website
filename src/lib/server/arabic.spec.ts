import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import { ftsNormalizeSqlExpr, normalizeArabic } from "./arabic";

describe("normalizeArabic", () => {
  it("strips harakat, tatweel and dagger alif", () => {
    expect(normalizeArabic("مُنتَجٌ")).toBe("منتج");
    expect(normalizeArabic("عَـسَلٰ")).toBe("عسل");
  });

  it("unifies alef forms", () => {
    expect(normalizeArabic("أحمد إبراهيم آمن")).toBe("احمد ابراهيم امن");
    expect(normalizeArabic("ٱلعسل")).toBe("العسل");
  });

  it("folds taa marbuta into heh and alef maqsura into yeh", () => {
    expect(normalizeArabic("مملكة")).toBe("مملكه");
    expect(normalizeArabic("على")).toBe("علي");
  });

  it("keeps hamza carriers and non-Arabic text untouched", () => {
    expect(normalizeArabic("سؤال مئية")).toBe("سؤال مئيه");
    expect(normalizeArabic("Sidr Honey 1kg")).toBe("Sidr Honey 1kg");
    expect(normalizeArabic("")).toBe("");
  });
});

describe("ftsNormalizeSqlExpr", () => {
  const client = createClient({ url: ":memory:" });

  async function sqlNorm(value: string): Promise<string> {
    const escaped = value.replaceAll("'", "''");
    const result = await client.execute(`SELECT ${ftsNormalizeSqlExpr(`'${escaped}'`)} AS out`);
    const out = result.rows[0]?.out;
    if (typeof out !== "string") throw new Error("unexpected non-string REPLACE result");
    return out;
  }

  it("matches the TypeScript normalizer on SQLite", async () => {
    for (const sample of ["مُنتَجٌ", "أفرولات إيطالي", "عَسل سِدرٌ", "خلطة 1كج", "plain"]) {
      expect(await sqlNorm(sample)).toBe(normalizeArabic(sample));
    }
  });

  it("stays in sync with the checked-in FTS normalization migration", () => {
    const migration = readFileSync("drizzle/0010_arabic_fts_normalization.sql", "utf8");
    for (const column of ["name", "description", "name_en", "description_en"]) {
      expect(migration).toContain(ftsNormalizeSqlExpr(`new.${column}`));
      expect(migration).toContain(ftsNormalizeSqlExpr(column));
    }
  });
});
