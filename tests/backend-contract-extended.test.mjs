import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";

async function readServerSource() {
  return fs.readFile("backend/server.mjs", "utf8");
}

function compact(str) {
  return str.replace(/\s+/g, " ");
}

test("purchase order mutation logic remains strictly defined in server.mjs", async () => {
  const source = compact(await readServerSource());

  assert.ok(source.includes("INSERT INTO purchase_items"));
  assert.ok(source.includes("UPDATE inventory SET qty_kg=qty_kg+$1"));
  assert.ok(source.includes("INSERT INTO inventory_movements"));
});

test("report and auth routes remain scoped to their contract", async () => {
  const source = compact(await readServerSource());

  assert.ok(source.includes('route === "/api/auth/me" && req.method === "GET"'));
  assert.ok(source.includes('route === "/api/auth/login" && req.method === "POST"'));
  assert.ok(source.includes('route === "/api/auth/logout" && req.method === "POST"'));
  assert.ok(source.includes('route === "/api/reports/summary" && req.method === "GET"'));
});
