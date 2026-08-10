import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverUrl = new URL("../backend/server.mjs", import.meta.url);
const schemaChangesUrl = new URL("../SCHEMA_CHANGES.md", import.meta.url);

async function readText(url) {
  return readFile(url, "utf8");
}

function compact(source) {
  return source.replace(/\s+/g, " ");
}

test("sale creation snapshots transaction price without breaking older schemas", async () => {
  const source = compact(await readText(serverUrl));

  assert.match(source, /const tableColumnCache = new Map\(\);/);
  assert.match(source, /async function getTableColumns\(client, table\)/);
  assert.match(source, /FROM information_schema\.columns/);
  assert.match(source, /const salesItemColumns = await getTableColumns\(client, "sales_items"\);/);
  assert.match(source, /const priceHistoryColumns = await getTableColumns\(client, "price_history"\);/);
  assert.match(source, /if \(salesItemColumns\.has\("price_snapshot"\)\)/);
  assert.match(source, /if \(salesItemColumns\.has\("price_source"\)\) \{\s*columns\.push\("price_source"\);\s*values\.push\("transaction"\);/);
  assert.match(source, /INSERT INTO price_history\(material_id,price_type,price_per_kg,effective_from,effective_to,changed_by,note\)/);
});

test("schema notes stay documentation-only and do not run migrations", async () => {
  const source = compact(await readText(serverUrl));

  assert.ok(!source.includes("ALTER TABLE sales_items ADD COLUMN"));
});
