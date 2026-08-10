import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
const { Pool } = pg;
const root = path.dirname(fileURLToPath(import.meta.url));
const pool = new Pool({ connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/phe_lieu" });
try { await pool.query(await readFile(path.join(root,"schema.postgres.sql"),"utf8")); console.log("PostgreSQL schema is ready"); } finally { await pool.end(); }
