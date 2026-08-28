import { readFileSync, writeFileSync } from "fs";

const src = "/home/zeyad/projects/beeking-etman-website/d1-seed.sql";
const out = "/tmp/seed_ordered.sql";
const raw = readFileSync(src, "utf8");

const stmts = raw
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--") && !s.startsWith("--\n"));

const cats = [];
const prods = [];
const vars = [];
const imgs = [];
const dels = [];

for (const st of stmts) {
  if (st.startsWith("INSERT INTO store_category")) cats.push(st);
  else if (st.startsWith("INSERT INTO store_product ")) prods.push(st);
  else if (st.startsWith("INSERT INTO store_product_variant")) vars.push(st);
  else if (st.startsWith("INSERT INTO store_product_image")) imgs.push(st);
  else if (st.startsWith("DELETE FROM")) dels.push(st);
}

function parseValuesTuple(stmt) {
  const vi = stmt.indexOf("VALUES");
  const open = stmt.indexOf("(", vi);
  const values = [];
  let i = open + 1;
  let current = "";
  let inStr = false;
  for (; i < stmt.length; i++) {
    const c = stmt[i];
    if (inStr) {
      if (c === "'") {
        if (stmt[i + 1] === "'") {
          current += "'";
          i++;
          continue;
        }
        inStr = false;
      } else current += c;
    } else {
      if (c === "'") {
        inStr = true;
        current += c;
      } else if (c === ",") {
        values.push(current.trim());
        current = "";
      } else if (c === ")") {
        values.push(current.trim());
        break;
      } else current += c;
    }
  }
  return values;
}

function clean(v) {
  if (!v) return null;
  v = v.trim();
  if (v === "NULL") return null;
  if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
  return v;
}

const catInfo = new Map();
for (const st of cats) {
  const v = parseValuesTuple(st);
  const id = clean(v[0]);
  catInfo.set(id, { id, parent: clean(v[5]), stmt: st });
}

const order = [];
const seen = new Set();
const visiting = new Set();

function visit(id) {
  if (seen.has(id)) return;
  if (visiting.has(id)) throw new Error("cycle at " + id);
  visiting.add(id);
  const node = catInfo.get(id);
  if (node && node.parent && catInfo.has(node.parent)) visit(node.parent);
  visiting.delete(id);
  seen.add(id);
  order.push(id);
}

for (const id of catInfo.keys()) visit(id);

const orderedCats = order.map((id) => catInfo.get(id).stmt);
let out2 = orderedCats.join(";\n") + ";\n";
for (const arr of [prods, vars, imgs, dels]) out2 += arr.join(";\n") + (arr.length ? ";\n" : "");
writeFileSync(out, out2);

const idx = new Map();
order.forEach((id, i) => idx.set(id, i));
let ok = true;
for (const [id, node] of catInfo) {
  if (node.parent && catInfo.has(node.parent) && idx.get(node.parent) > idx.get(id)) {
    ok = false;
    console.log("FK VIOLATION", id);
  }
}
console.log(
  "cats",
  cats.length,
  "prods",
  prods.length,
  "vars",
  vars.length,
  "imgs",
  imgs.length,
  "dels",
  dels.length,
);
console.log("FK order ok:", ok);
console.log("wrote", out, out2.length, "bytes");
