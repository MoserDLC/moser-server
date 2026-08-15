const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const initSqlJs = require("sql.js");
const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 8080;
const DB_PATH = path.join(__dirname, "moser.db");
const CLIENT_DIR = path.join(__dirname, "client-files");

app.use(cors());
app.use(express.json());

let db;

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL DEFAULT '',
      hwid TEXT DEFAULT '',
      token TEXT UNIQUE,
      plan TEXT DEFAULT 'free',
      expires_at DATETIME DEFAULT NULL,
      created DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_code TEXT UNIQUE NOT NULL,
      used INTEGER DEFAULT 0,
      user_id INTEGER,
      plan TEXT DEFAULT 'month',
      created DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  saveDb();
  console.log("[DB] Initialized");
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    result = {};
    cols.forEach((c, i) => (result[c] = vals[i]));
  }
  stmt.free();
  return result;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => (row[c] = vals[i]));
    results.push(row);
  }
  stmt.free();
  return results;
}

function runSql(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function generateToken() {
  return crypto.randomUUID();
}

function generateKeyPart() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function generateKeyCode() {
  return `MOSER-${generateKeyPart()}-${generateKeyPart()}-${generateKeyPart()}-${generateKeyPart()}`;
}

// --- Auth ---

app.post("/api/auth/register", (req, res) => {
  const { login, password, hwid } = req.body;

  if (!login || login.length < 3) return res.json({ error: "Логин минимум 3 символа" });
  if (!password || password.length < 6) return res.json({ error: "Пароль минимум 6 символов" });
  if (!hwid) return res.json({ error: "HWID обязателен" });

  const existing = queryOne("SELECT id FROM users WHERE login = ?", [login]);
  if (existing) return res.json({ error: "Пользователь уже существует" });

  const hash = bcrypt.hashSync(password, 10);
  const token = generateToken();

  try {
    runSql("INSERT INTO users (login, password_hash, hwid, token, plan, expires_at) VALUES (?, ?, ?, ?, 'free', NULL)", [login, hash, hwid, token]);
    console.log(`[Register] ${login} (hwid: ${hwid.substring(0, 8)}...)`);
    res.json({ token, login, plan: "free", expires: null });
  } catch (err) {
    console.error("[Register] Error:", err.message);
    res.json({ error: "Ошибка регистрации" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { login, password, hwid } = req.body;

  if (!login || !password || !hwid) return res.json({ error: "Все поля обязательны" });

  const user = queryOne("SELECT * FROM users WHERE login = ?", [login]);
  if (!user) return res.json({ error: "Неверный логин или пароль" });

  if (user.password_hash && !bcrypt.compareSync(password, user.password_hash)) {
    return res.json({ error: "Неверный логин или пароль" });
  }

  if (user.hwid && user.hwid !== hwid) {
    return res.json({ error: "Аккаунт привязан к другому устройству" });
  }

  const token = user.token || generateToken();
  runSql("UPDATE users SET hwid = ?, token = ? WHERE id = ?", [hwid, token, user.id]);

  let plan = user.plan;
  if (user.expires_at && new Date(user.expires_at) < new Date()) {
    plan = "free";
  }

  console.log(`[Login] ${login}`);
  res.json({ token, login: user.login, plan, expires: user.expires_at });
});

app.get("/api/auth/check", (req, res) => {
  const { token, hwid } = req.query;
  if (!token || !hwid) return res.json({ error: "token и hwid обязательны" });

  const user = queryOne("SELECT * FROM users WHERE token = ?", [token]);
  if (!user) return res.json({ error: "Невалидный токен" });
  if (user.hwid && user.hwid !== hwid) return res.json({ error: "HWID не совпадает" });

  let plan = user.plan;
  if (user.expires_at && new Date(user.expires_at) < new Date()) {
    plan = "free";
  }

  res.json({ valid: true, login: user.login, plan, expires: user.expires_at });
});

app.post("/api/auth/activate", (req, res) => {
  const { key, hwid } = req.body;
  if (!key || !hwid) return res.json({ error: "Ключ и HWID обязательны" });

  const keyRow = queryOne("SELECT * FROM keys WHERE key_code = ? AND used = 0", [key]);
  if (!keyRow) return res.json({ error: "Неверный или использованный ключ" });

  const login = "user_" + key.substring(6, 14).toLowerCase();
  const token = generateToken();

  const planDays = { month: 30, "3months": 90, lifetime: 36500 };
  const days = planDays[keyRow.plan] || 30;
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

  runSql("INSERT INTO users (login, password_hash, hwid, token, plan, expires_at) VALUES (?, '', ?, ?, ?, ?)", [login, hwid, token, keyRow.plan, expiresAt]);
  const user = queryOne("SELECT id FROM users WHERE token = ?", [token]);
  runSql("UPDATE keys SET used = 1, user_id = ? WHERE id = ?", [user.id, keyRow.id]);

  console.log(`[Activate] Key ${key} → ${login} (${keyRow.plan}, expires: ${expiresAt})`);
  res.json({ token, login, plan: keyRow.plan, expires: expiresAt });
});

// --- Admin ---

app.post("/api/admin/keys/generate", (req, res) => {
  const { plan, count } = req.body;
  if (!plan || !count || count <= 0) return res.json({ error: "plan и count обязательны" });

  const keys = [];
  for (let i = 0; i < count; i++) {
    const keyCode = generateKeyCode();
    runSql("INSERT INTO keys (key_code, plan) VALUES (?, ?)", [keyCode, plan]);
    keys.push(keyCode);
  }

  console.log(`[Admin] Generated ${count} keys (${plan})`);
  res.json({ keys, count: keys.length });
});

app.get("/api/admin/keys", (req, res) => {
  const keys = queryAll("SELECT * FROM keys ORDER BY id DESC LIMIT 100");
  res.json({ keys });
});

app.get("/api/admin/users", (req, res) => {
  const users = queryAll("SELECT id, login, hwid, plan, created FROM users ORDER BY id DESC LIMIT 100");
  res.json({ users });
});

// --- Client ---

app.get("/api/client/latest", (req, res) => {
  res.json({ version: "1.0.0", description: "Minecraft 1.21.11 Fabric" });
});

app.get("/api/client/download/:filename", (req, res) => {
  const filename = req.params.filename.replace(/[^a-zA-Z0-9._\-]/g, "");
  const filePath = path.join(CLIENT_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Файл не найден" });
  res.download(filePath);
});

// --- Start ---

initDB().then(() => {
  app.listen(PORT, () => {
    console.log("========================================");
    console.log("  MOSER SERVER v1.0.0");
    console.log("  http://localhost:" + PORT);
    console.log("========================================");
  });
}).catch((err) => {
  console.error("Failed to start:", err);
});

process.on("SIGINT", () => {
  if (db) saveDb();
  process.exit(0);
});
