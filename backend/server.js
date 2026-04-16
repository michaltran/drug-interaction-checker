require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "database", "drugs.db");
const JWT_SECRET = process.env.JWT_SECRET || "change_this_secret";

// =============================================
// Khởi tạo Database (tự động nếu chưa có)
// =============================================
if (!fs.existsSync(DB_PATH)) {
  console.log("⚠️  Database chưa tồn tại, đang khởi tạo...");
  require("./database/init.js");
}
const db = new Database(DB_PATH, { readonly: false });
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// =============================================
// Middleware
// =============================================
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());
app.use(morgan("short"));

// JWT Middleware
function authenticate(req, res, next) {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Chưa đăng nhập" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token hết hạn" });
  }
}

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").trim();
}

// =============================================
// AUTH
// =============================================
app.post("/api/auth/register", (req, res) => {
  try {
    const { username, password, full_name, role, department } = req.body;
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: "Thiếu thông tin bắt buộc" });
    }
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(
      "INSERT INTO users (username, password_hash, full_name, role, department) VALUES (?, ?, ?, ?, ?)"
    );
    const result = stmt.run(username, hash, full_name, role || "duoc_si", department || "");
    res.status(201).json({ id: result.lastInsertRowid, username, full_name, role: role || "duoc_si" });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      return res.status(400).json({ error: "Tên đăng nhập đã tồn tại" });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/auth/login", (req, res) => {
  try {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Sai tên đăng nhập hoặc mật khẩu" });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, name: user.full_name },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
    );
    db.prepare("INSERT INTO check_logs (user_id, drugs_checked, check_type) VALUES (?, ?, ?)").run(
      user.id, "login", "auth"
    );
    res.json({ token, user: { id: user.id, name: user.full_name, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// DRUGS - Danh mục thuốc
// =============================================
app.get("/api/drugs", (req, res) => {
  try {
    const { search } = req.query;
    let drugs;
    if (search) {
      const ns = "%" + normalize(search) + "%";
      drugs = db.prepare("SELECT * FROM drugs WHERE name_normalized LIKE ? ORDER BY name LIMIT 50").all(ns);
    } else {
      drugs = db.prepare("SELECT * FROM drugs ORDER BY name").all();
    }
    res.json({ drugs, total: drugs.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/drugs", authenticate, (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Thiếu tên thuốc" });
    const result = db.prepare("INSERT INTO drugs (name, name_normalized) VALUES (?, ?)").run(name, normalize(name));
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (err) {
    if (err.message.includes("UNIQUE")) return res.status(400).json({ error: "Thuốc đã tồn tại" });
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/drugs/:id", authenticate, (req, res) => {
  try {
    const { name } = req.body;
    db.prepare("UPDATE drugs SET name = ?, name_normalized = ? WHERE id = ?").run(name, normalize(name), req.params.id);
    res.json({ id: req.params.id, name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/drugs/:id", authenticate, (req, res) => {
  try {
    db.prepare("DELETE FROM drugs WHERE id = ?").run(req.params.id);
    res.json({ message: "Đã xóa" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// INTERACTIONS - Tương tác thuốc
// =============================================

// Tra cứu 2 thuốc
app.get("/api/interactions/check", (req, res) => {
  try {
    const { drug1, drug2 } = req.query;
    if (!drug1 || !drug2) return res.status(400).json({ error: "Cần drug1 và drug2" });
    const n1 = normalize(drug1), n2 = normalize(drug2);
    const results = db.prepare(`
      SELECT * FROM interactions WHERE is_active = 1 AND (
        (drug1_normalized = ? AND drug2_normalized = ?) OR
        (drug1_normalized = ? AND drug2_normalized = ?)
      )
    `).all(n1, n2, n2, n1);
    res.json({ interactions: results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tất cả tương tác của 1 thuốc
app.get("/api/interactions/drug/:name", (req, res) => {
  try {
    const nd = normalize(req.params.name);
    const results = db.prepare(`
      SELECT * FROM interactions WHERE is_active = 1 AND (drug1_normalized = ? OR drug2_normalized = ?) ORDER BY id
    `).all(nd, nd);
    res.json({ interactions: results, count: results.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Kiểm tra đơn thuốc (nhiều thuốc cùng lúc)
app.post("/api/interactions/check-prescription", (req, res) => {
  try {
    const { drugs, patient_name } = req.body;
    if (!drugs || !Array.isArray(drugs) || drugs.length < 2) {
      return res.status(400).json({ error: "Cần ít nhất 2 thuốc" });
    }

    const stmt = db.prepare(`
      SELECT * FROM interactions WHERE is_active = 1 AND (
        (drug1_normalized = ? AND drug2_normalized = ?) OR
        (drug1_normalized = ? AND drug2_normalized = ?)
      )
    `);

    const allInteractions = [];
    for (let i = 0; i < drugs.length; i++) {
      for (let j = i + 1; j < drugs.length; j++) {
        const n1 = normalize(drugs[i]), n2 = normalize(drugs[j]);
        const found = stmt.all(n1, n2, n2, n1);
        found.forEach(f => allInteractions.push({ ...f, checked_pair: [drugs[i], drugs[j]] }));
      }
    }

    // Log
    db.prepare("INSERT INTO check_logs (patient_name, drugs_checked, interactions_found, check_type) VALUES (?, ?, ?, ?)")
      .run(patient_name || "", JSON.stringify(drugs), allInteractions.length, "prescription");

    res.json({
      drugs_checked: drugs,
      patient_name: patient_name || null,
      interactions: allInteractions,
      count: allInteractions.length,
      is_safe: allInteractions.length === 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Danh sách tất cả tương tác
app.get("/api/interactions", (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let results, total;

    if (search) {
      const ns = "%" + normalize(search) + "%";
      results = db.prepare(`
        SELECT * FROM interactions WHERE is_active = 1 
        AND (drug1_normalized LIKE ? OR drug2_normalized LIKE ? OR LOWER(mechanism) LIKE ?)
        ORDER BY id LIMIT ? OFFSET ?
      `).all(ns, ns, ns, parseInt(limit), offset);
      total = db.prepare(`
        SELECT COUNT(*) as c FROM interactions WHERE is_active = 1 
        AND (drug1_normalized LIKE ? OR drug2_normalized LIKE ? OR LOWER(mechanism) LIKE ?)
      `).get(ns, ns, ns).c;
    } else {
      results = db.prepare("SELECT * FROM interactions WHERE is_active = 1 ORDER BY id LIMIT ? OFFSET ?")
        .all(parseInt(limit), offset);
      total = db.prepare("SELECT COUNT(*) as c FROM interactions WHERE is_active = 1").get().c;
    }

    res.json({ interactions: results, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Thêm tương tác mới
app.post("/api/interactions", authenticate, (req, res) => {
  try {
    const { drug1, drug2, mechanism, consequence, management } = req.body;
    if (!drug1 || !drug2 || !mechanism || !consequence || !management) {
      return res.status(400).json({ error: "Thiếu thông tin" });
    }
    const result = db.prepare(`
      INSERT INTO interactions (drug1, drug2, drug1_normalized, drug2_normalized, mechanism, consequence, management)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(drug1, drug2, normalize(drug1), normalize(drug2), mechanism, consequence, management);
    res.status(201).json({ id: result.lastInsertRowid, drug1, drug2 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sửa tương tác
app.put("/api/interactions/:id", authenticate, (req, res) => {
  try {
    const { drug1, drug2, mechanism, consequence, management } = req.body;
    db.prepare(`
      UPDATE interactions SET drug1=?, drug2=?, drug1_normalized=?, drug2_normalized=?,
      mechanism=?, consequence=?, management=?, updated_at=datetime('now') WHERE id=?
    `).run(drug1, drug2, normalize(drug1), normalize(drug2), mechanism, consequence, management, req.params.id);
    res.json({ message: "Đã cập nhật" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xóa tương tác (soft delete)
app.delete("/api/interactions/:id", authenticate, (req, res) => {
  try {
    db.prepare("UPDATE interactions SET is_active = 0 WHERE id = ?").run(req.params.id);
    res.json({ message: "Đã xóa" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// THỐNG KÊ
// =============================================
app.get("/api/stats/overview", (req, res) => {
  try {
    const drugs = db.prepare("SELECT COUNT(*) as c FROM drugs").get().c;
    const interactions = db.prepare("SELECT COUNT(*) as c FROM interactions WHERE is_active = 1").get().c;
    const checks = db.prepare("SELECT COUNT(*) as c FROM check_logs WHERE check_type = 'prescription'").get().c;
    res.json({ total_drugs: drugs, total_interactions: interactions, total_checks: checks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stats/top-drugs", (req, res) => {
  try {
    const results = db.prepare(`
      SELECT drug_name, COUNT(*) as count FROM (
        SELECT drug1 as drug_name FROM interactions WHERE is_active = 1
        UNION ALL
        SELECT drug2 as drug_name FROM interactions WHERE is_active = 1
      ) GROUP BY drug_name ORDER BY count DESC LIMIT 20
    `).all();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/stats/recent-checks", (req, res) => {
  try {
    const results = db.prepare(
      "SELECT * FROM check_logs WHERE check_type = 'prescription' ORDER BY created_at DESC LIMIT 50"
    ).all();
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    const drugs = db.prepare("SELECT COUNT(*) as c FROM drugs").get().c;
    const interactions = db.prepare("SELECT COUNT(*) as c FROM interactions").get().c;
    res.json({ status: "ok", drugs, interactions, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: "error", message: err.message });
  }
});

// =============================================
// Serve Frontend (production)
// =============================================
if (process.env.NODE_ENV === "production") {
  const frontendPath = path.join(__dirname, "..", "frontend", "dist");
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    app.get("*", (req, res) => {
      if (!req.path.startsWith("/api")) {
        res.sendFile(path.join(frontendPath, "index.html"));
      }
    });
  }
}

// =============================================
// START
// =============================================
app.listen(PORT, () => {
  const drugs = db.prepare("SELECT COUNT(*) as c FROM drugs").get().c;
  const interactions = db.prepare("SELECT COUNT(*) as c FROM interactions").get().c;
  console.log(`\n🏥 Drug Interaction API`);
  console.log(`📋 QĐ 5948/QĐ-BYT — ${drugs} hoạt chất, ${interactions} cặp tương tác`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api/health\n`);
});
