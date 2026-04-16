# 🚀 Hướng dẫn đẩy lên GitHub & Deploy

## Bước 1: Tạo Repository trên GitHub

1. Vào https://github.com → nhấn **"+"** → **"New repository"**
2. Điền thông tin:
   - **Repository name:** `drug-interaction-checker`
   - **Description:** `Phần mềm tương tác thuốc chống chỉ định - QĐ 5948/QĐ-BYT`
   - Chọn **Public** hoặc **Private**
   - ❌ KHÔNG tick "Add a README" (vì mình đã có sẵn)
3. Nhấn **"Create repository"**
4. Copy URL repo, ví dụ: `https://github.com/username/drug-interaction-checker.git`

---

## Bước 2: Cài Git (nếu chưa có)

### Windows
Tải tại: https://git-scm.com/download/win → cài mặc định

### Mac
```bash
brew install git
```

### Linux
```bash
sudo apt install git
```

**Cấu hình lần đầu:**
```bash
git config --global user.name "Tên của bạn"
git config --global user.email "email@example.com"
```

---

## Bước 3: Đẩy code lên GitHub

### Mở Terminal/CMD, chạy lần lượt:

```bash
# 1. Giải nén file zip (nếu chưa)
unzip drug-interaction-app.zip -d drug-interaction-checker
cd drug-interaction-checker

# 2. Khởi tạo Git
git init

# 3. Thêm tất cả file
git add .

# 4. Commit lần đầu
git commit -m "feat: khởi tạo phần mềm tương tác thuốc - QĐ 5948/QĐ-BYT (633 cặp, 266 hoạt chất)"

# 5. Đổi branch mặc định
git branch -M main

# 6. Kết nối với GitHub (thay URL bằng repo của bạn)
git remote add origin https://github.com/USERNAME/drug-interaction-checker.git

# 7. Đẩy lên
git push -u origin main
```

> **Lần đầu push:** GitHub sẽ hỏi đăng nhập.
> - Nếu dùng HTTPS: nhập username + Personal Access Token (không phải password)
> - Tạo token tại: https://github.com/settings/tokens → "Generate new token (classic)" → tick "repo" → Generate

---

## Bước 4: Cập nhật code sau này

```bash
# Mỗi lần sửa code xong:
git add .
git commit -m "mô tả thay đổi"
git push
```

---

## Bước 5: Deploy tự động từ GitHub

### Cách A: Deploy lên Render.com (MIỄN PHÍ)

1. Vào https://render.com → Sign up bằng GitHub
2. Nhấn **"New +"** → **"Web Service"**
3. Kết nối repo `drug-interaction-checker`
4. Cấu hình:
   - **Build Command:** `cd frontend && npm install && npm run build && cd ../backend && npm install && npm run init-db`
   - **Start Command:** `cd backend && node server.js`
   - **Environment Variables:**
     - `NODE_ENV` = `production`
     - `JWT_SECRET` = `mat_khau_manh_cua_ban`
5. Nhấn **"Create Web Service"**
6. Đợi 2-3 phút → có link `https://drug-interaction-checker.onrender.com`

### Cách B: Deploy lên Railway.app (miễn phí 500h/tháng)

1. Vào https://railway.app → Login bằng GitHub
2. **"New Project"** → **"Deploy from GitHub Repo"**
3. Chọn repo `drug-interaction-checker`
4. Thêm biến môi trường: `JWT_SECRET`, `NODE_ENV=production`
5. Tự động deploy!

### Cách C: Deploy lên VPS từ GitHub

```bash
# SSH vào VPS
ssh user@your-server

# Clone từ GitHub
git clone https://github.com/USERNAME/drug-interaction-checker.git
cd drug-interaction-checker

# Chạy Docker
docker compose up -d --build

# HOẶC chạy trực tiếp
cd backend && npm install && npm run init-db && npm start

# Auto-update khi push code mới:
git pull && docker compose up -d --build
```

---

## Tóm tắt luồng hoạt động

```
Bạn sửa code → git push → GitHub
                              ↓
                     Render/Railway tự build
                              ↓
                     Website cập nhật tự động
```
