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
