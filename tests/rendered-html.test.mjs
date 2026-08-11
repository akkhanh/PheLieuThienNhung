import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the Thien Nhung public site content", async () => {
  const [entry, publicHome] = await Promise.all([
    readFile(new URL("../frontend/pages/Home.tsx", import.meta.url), "utf8"),
    readFile(new URL("../frontend/components/home/PublicHome.tsx", import.meta.url), "utf8"),
  ]);
  const source = `${entry}\n${publicHome}`;
  assert.match(source, /Phế Liệu/);
  assert.match(source, /Thiên Nhung/);
  assert.match(source, /Giá thu mua hôm nay/);
  assert.match(source, /ƯỚC TÍNH NHANH/);
});
