import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import pg from "pg";

const { Pool } = pg;

export const testDbUrl = process.env.DATABASE_URL || "postgresql://postgres:123456@localhost:5432/phe_lieu";
export const testPort = Number(process.env.REPORTS_TEST_PORT || 4010);
export const baseUrl = `http://127.0.0.1:${testPort}`;

export async function createPool() {
  return new Pool({ connectionString: testDbUrl });
}

export async function createSessionForEmail(email) {
  const pool = await createPool();
  try {
    const user = (await pool.query("SELECT id, email, role FROM users WHERE email=$1", [email])).rows[0];
    if (!user) throw new Error(`No seeded user found for ${email}`);
    const token = randomUUID().replace(/-/g, "");
    const csrf = randomUUID().replace(/-/g, "");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    await pool.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')", [tokenHash, user.id]);
    return { cookie: `session=${token}; csrf=${csrf}`, user };
  } finally {
    await pool.end();
  }
}

async function canConnect(port, timeoutMs = 150) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureBackendStarted() {
  if (await canConnect(testPort)) return { started: false, process: null };

  const proc = spawn("node", ["backend/server.mjs"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      DATABASE_URL: testDbUrl,
      FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
      NODE_ENV: process.env.NODE_ENV || "development",
      PORT: String(testPort),
    },
    windowsHide: true,
  });

  const stderr = [];
  proc.stderr.on("data", (chunk) => stderr.push(chunk.toString("utf8")));

  for (let i = 0; i < 60; i += 1) {
    if (await canConnect(testPort)) return { started: true, process: proc };
    if (proc.exitCode !== null) {
      throw new Error(`backend exited early with code ${proc.exitCode}: ${stderr.join("").trim()}`);
    }
    await delay(250);
  }

  proc.kill();
  throw new Error(`backend did not become ready on ${baseUrl}`);
}

export async function login(sessionLabel, email, password) {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(`${sessionLabel} login failed: ${res.status} ${JSON.stringify(body)}`);
  }
  const setCookie = res.headers.get("set-cookie") || "";
  const session = setCookie.match(/session=([^;]+)/)?.[1];
  const csrf = setCookie.match(/csrf=([^;]+)/)?.[1];
  if (!session || !csrf) throw new Error(`${sessionLabel} login missing cookies: ${setCookie}`);
  return { cookie: `session=${session}; csrf=${csrf}`, user: body.user };
}

export async function requestJson(path, { cookie, method = "GET", body } = {}) {
  const csrf = cookie?.match(/csrf=([^;]+)/)?.[1];
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(csrf && method !== "GET" ? { "x-csrf-token": csrf } : {}),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { res, json };
}
