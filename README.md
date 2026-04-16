# 🏥 Drug Interaction Checker

> **Phần mềm tương tác thuốc chống chỉ định — QĐ 5948/QĐ-BYT (30/12/2021)**  
> 633 cặp tương tác • 266 hoạt chất • Dành cho dược sĩ lâm sàng & bác sĩ

---

## 📁 Cấu trúc

```
drug-app-final/
├── backend/
│   ├── server.js                 ← API server (Express + SQLite)
│   ├── package.json
│   ├── .env.example
│   └── database/
│       ├── init.js               ← Script tạo DB + import 633 tương tác
│       └── seed_data.json        ← DỮ LIỆU: 266 thuốc + 633 cặp tương tác
├── frontend/
│   ├── src/App.jsx               ← Giao diện React (có nhúng sẵn dữ liệu)
│   ├── src/main.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── Dockerfile                    ← Build 1 container duy nhất
├── docker-compose.yml            ← Deploy 1 lệnh
└── README.md
```

---

## 🚀 DEPLOY

### Cách 1: Docker — 1 lệnh (khuyên dùng)

```bash
# Yêu cầu: Docker đã cài
docker compose up -d --build

# Xong! Truy cập: http://localhost:5000
```

Dừng: `docker compose down`  
Xem logs: `docker compose logs -f`

---

### Cách 2: Chạy trực tiếp (không Docker)

```bash
# 1. Cài backend
cd backend
npm install

# 2. Tạo database (266 thuốc + 633 tương tác)
npm run init-db
# → Tạo file database/drugs.db

# 3. Tạo .env
cp .env.example .env
# Sửa JWT_SECRET trong .env

# 4. Chạy backend
npm start
# → API tại http://localhost:5000

# 5. (Tab mới) Chạy frontend
cd ../frontend
npm install
npm run dev
# → Web tại http://localhost:3000
```

---

### Cách 3: Deploy production trên VPS

```bash
# 1. SSH vào VPS
ssh user@your-server

# 2. Clone project lên server
# 3. Build frontend
cd frontend && npm install && npm run build

# 4. Chạy backend (serve cả frontend)
cd ../backend
cp .env.example .env
# Sửa .env: NODE_ENV=production, JWT_SECRET=...
npm install
npm run init-db
npm start

# → Cả API + Web tại http://your-server:5000
```

**Dùng PM2 để chạy nền:**
```bash
npm install -g pm2
cd backend
pm2 start server.js --name drug-api
pm2 save
pm2 startup
```

**Thêm Nginx + SSL:**
```nginx
server {
    listen 80;
    server_name drug.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
```bash
sudo certbot --nginx -d drug.yourdomain.com
```

---

## 📡 API

| Method | Endpoint | Mô tả |
|--------|---------|-------|
| `GET` | `/api/health` | Kiểm tra server + số liệu |
| `GET` | `/api/drugs` | Danh sách thuốc (`?search=para`) |
| `GET` | `/api/interactions/check?drug1=X&drug2=Y` | Tra cứu 2 thuốc |
| `GET` | `/api/interactions/drug/Colchicin` | Tất cả tương tác của 1 thuốc |
| `POST` | `/api/interactions/check-prescription` | Kiểm tra đơn thuốc |
| `GET` | `/api/stats/overview` | Thống kê tổng quan |
| `GET` | `/api/stats/top-drugs` | Top thuốc nhiều tương tác |
| `POST` | `/api/auth/login` | Đăng nhập |
| `POST` | `/api/auth/register` | Đăng ký |
| `POST` | `/api/drugs` | Thêm thuốc (cần token) |
| `POST` | `/api/interactions` | Thêm tương tác (cần token) |

### Ví dụ

```bash
# Tra cứu tương tác
curl "http://localhost:5000/api/interactions/check?drug1=Colchicin&drug2=Erythromycin"

# Kiểm tra đơn thuốc
curl -X POST http://localhost:5000/api/interactions/check-prescription \
  -H "Content-Type: application/json" \
  -d '{"drugs":["Colchicin","Erythromycin","Simvastatin"],"patient_name":"Nguyễn Văn A"}'

# Đăng nhập (tài khoản mặc định: admin/admin123)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## 🔗 Tích hợp HIS

```
Bác sĩ kê đơn → HIS gọi API check-prescription → Cảnh báo → Xác nhận/sửa đơn
```

```javascript
// Gọi từ HIS khi bác sĩ thêm thuốc vào đơn
const res = await fetch('http://drug-api:5000/api/interactions/check-prescription', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ drugs: ['Colchicin', 'Erythromycin'] })
});
const data = await res.json();
if (!data.is_safe) alert('CẢNH BÁO: ' + data.count + ' tương tác chống chỉ định!');
```

---

## 🔒 Bảo mật

- Đổi `JWT_SECRET` trong `.env` trước khi deploy
- Đổi mật khẩu admin mặc định (`admin/admin123`)
- Bật HTTPS bằng Certbot
- Database SQLite được lưu trong Docker volume (persistent)
