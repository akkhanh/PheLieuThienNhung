import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serverUrl = new URL("../backend/server.mjs", import.meta.url);

async function readText(url) {
  return readFile(url, "utf8");
}

function compact(source) {
  return source.replace(/\s+/g, " ");
}

test("purchase and sale creation preserve price snapshots on old schemas", async () => {
  const source = compact(await readText(serverUrl));

  assert.match(source, /const purchaseItemColumns = await getTableColumns\(client, "purchase_items"\);/);
  assert.match(source, /if \(purchaseItemColumns\.has\("price_snapshot"\)\)/);
  assert.match(source, /if \(purchaseItemColumns\.has\("price_source"\)\)\s*\{\s*columns\.push\("price_source"\);\s*values\.push\("transaction"\);/);
  assert.match(source, /const priceHistoryColumns = await getTableColumns\(client, "price_history"\);/);
  assert.match(source, /INSERT INTO price_history\(material_id,price_type,price_per_kg,effective_from,effective_to,changed_by,note\)/);
});

