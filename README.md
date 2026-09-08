# UBND_KTYTE - môi trường chạy web

Ứng dụng dùng React/Vite, ASP.NET Core 8 và SQLite. VS Code đã được cấu hình để sử dụng Node.js và .NET trong workspace.

## Chạy source bằng VS Code

Sau khi mở workspace, đóng terminal cũ và tạo hai terminal mới.

Terminal frontend:

```powershell
cd frontend
npm run dev
```

Terminal backend:

```powershell
cd backend
dotnet run
```

- Web: http://localhost:5173
- Swagger: http://localhost:5022/swagger

## Build

Frontend:

```powershell
cd frontend
npm run build
```

Backend:

```powershell
cd backend
dotnet build -c Release
```

## Chạy online bằng GitHub Codespaces

1. Đưa repository lên GitHub.
2. Mở repository, chọn **Code** > **Codespaces** > **Create codespace on main**.
3. Codespaces sẽ tự cài Node.js, .NET 8, package frontend và chạy frontend/backend.
4. Mở port **5173** trong thông báo hoặc tab **Ports** để sử dụng ứng dụng.

Swagger của backend chạy ở port **5022**. Dữ liệu SQLite của Codespace được lưu trong thư mục `.data` của workspace.

## Deploy online: GitHub + Render + Supabase

Repository đã có sẵn file `render.yaml` và Dockerfile cho Render.

1. Tạo project trên [Supabase](https://supabase.com), mở **Connect** và sao chép connection string PostgreSQL dạng ADO.NET/Npgsql. Dùng **Session pooler** nếu Render không kết nối được tới host direct của Supabase.
2. Trên [Render](https://render.com), chọn **New** > **Blueprint**, kết nối repository `ngogiang270593/UBND_KTYTE` và chọn branch `main`.
3. Khi Render hỏi biến bí mật của API, nhập connection string vào `DATABASE_URL`. Không commit connection string hoặc mật khẩu vào GitHub.
4. Render sẽ tạo hai dịch vụ:
	- API: `ubnd-ktyte-api`
	- Web: `ubnd-ktyte-web`
5. Mở URL của dịch vụ web: `https://ubnd-ktyte-web.onrender.com`.

Lần khởi động đầu tiên sẽ tự tạo các bảng PostgreSQL và tài khoản mặc định `admin` / `123456`. Hãy đổi mật khẩu ngay sau khi đăng nhập. Gói Render Free có thể sleep khi không có truy cập; lần mở đầu tiên sau đó sẽ mất thêm thời gian khởi động.
