import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the Thien Nhung public site content", async () => {
  const source = await readFile(new URL("../frontend/pages/Home.tsx", import.meta.url), "utf8");
  assert.match(source, /Phế Liệu/);
  assert.match(source, /Thiên Nhung/);
  assert.match(source, /Giá thu mua hôm nay/);
  assert.match(source, /ƯỚC TÍNH NHANH/);
});
