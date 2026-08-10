import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const modalUrl = new URL("../frontend/components/OrderModal.tsx", import.meta.url);

test("order modal promotes guest via customer endpoint and sends line discounts", async () => {
  const source = await readFile(modalUrl, "utf8");
  assert.ok(source.includes("const guestCustomer = await adminApi.createCustomer({"));
  assert.ok(source.includes("discount_amount"));
  assert.ok(source.includes("customerDiscountAmount"));
  assert.ok(source.includes("selectedCustomerId !== \"guest\""));
  assert.ok(source.includes("customer_id: customerId"));
});
