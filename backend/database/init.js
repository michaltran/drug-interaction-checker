const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "drugs.db");
const SEED_PATH = path.join(__dirname, "seed_data.json");

console.log("🔧 Khởi tạo database...");
console.log(`   Path: ${DB_PATH}`);

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log("   ↳ Đã xóa database cũ");
}

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'duoc_si',
    department TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS drugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    name_normalized TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY,
    drug1 TEXT NOT NULL,
    drug2 TEXT NOT NULL,
    drug1_normalized TEXT NOT NULL,
    drug2_normalized TEXT NOT NULL,
    mechanism TEXT NOT NULL,
    consequence TEXT NOT NULL,
    management TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS check_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    patient_name TEXT,
    drugs_checked TEXT NOT NULL,
    interactions_found INTEGER DEFAULT 0,
    check_type TEXT DEFAULT 'prescription',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_drug1_norm ON interactions(drug1_normalized);
  CREATE INDEX IF NOT EXISTS idx_drug2_norm ON interactions(drug2_normalized);
  CREATE INDEX IF NOT EXISTS idx_drugs_name_norm ON drugs(name_normalized);
  CREATE INDEX IF NOT EXISTS idx_logs_date ON check_logs(created_at);
`);

console.log("   ↳ Tạo bảng thành công");

function normalize(str) {
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").trim();
}

// Load seed data
if (!fs.existsSync(SEED_PATH)) {
  console.error("❌ Không tìm thấy seed_data.json tại:", SEED_PATH);
  process.exit(1);
}

const seedData = JSON.parse(fs.readFileSync(SEED_PATH, "utf-8"));

// Insert drugs
const insertDrug = db.prepare("INSERT OR IGNORE INTO drugs (name, name_normalized) VALUES (?, ?)");
const insertDrugs = db.transaction((drugs) => {
  for (const drug of drugs) insertDrug.run(drug, normalize(drug));
});
insertDrugs(seedData.drugs);
console.log(`   ↳ Đã thêm ${seedData.drugs.length} hoạt chất`);

// Insert interactions
const insertInteraction = db.prepare(`
  INSERT OR REPLACE INTO interactions
  (id, drug1, drug2, drug1_normalized, drug2_normalized, mechanism, consequence, management)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertAll = db.transaction((interactions) => {
  for (const i of interactions) {
    insertInteraction.run(i.id, i.drug1, i.drug2, normalize(i.drug1), normalize(i.drug2), i.mechanism, i.consequence, i.management);
  }
});
insertAll(seedData.interactions);
console.log(`   ↳ Đã thêm ${seedData.interactions.length} cặp tương tác`);

// Create default admin (password: admin123)
const bcrypt = require("bcryptjs");
const adminHash = bcrypt.hashSync("admin123", 10);
db.prepare("INSERT OR IGNORE INTO users (username, password_hash, full_name, role, department) VALUES (?, ?, ?, ?, ?)")
  .run("admin", adminHash, "Quản trị viên", "admin", "Khoa Dược");
console.log("   ↳ Tạo tài khoản admin mặc định (admin/admin123)");

db.close();
console.log("\n✅ Khởi tạo database hoàn tất!");
console.log(`   ${seedData.drugs.length} hoạt chất + ${seedData.interactions.length} cặp tương tác`);
console.log("   Theo QĐ 5948/QĐ-BYT ngày 30/12/2021\n");
