using backend.Data;
using Microsoft.Data.Sqlite;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Electron chạy backend dưới tài khoản người dùng thông thường. Không ghi vào
// Windows Event Log vì provider này có thể bị từ chối quyền và làm chậm startup.
builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var jwtKey = Environment.GetEnvironmentVariable("JWT_KEY")
    ?? "APP2026_SECRET_KEY_LOGIN_JWT_123456789";

var postgresConnectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
    ?? Environment.GetEnvironmentVariable("SUPABASE_CONNECTION_STRING");
if (!string.IsNullOrWhiteSpace(postgresConnectionString)
    && (postgresConnectionString.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
        || postgresConnectionString.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)))
{
    var databaseUri = new Uri(postgresConnectionString);
    var userInfo = databaseUri.UserInfo.Split(':', 2);
    postgresConnectionString = new NpgsqlConnectionStringBuilder
    {
        Host = databaseUri.Host,
        Port = databaseUri.Port > 0 ? databaseUri.Port : 5432,
        Database = databaseUri.AbsolutePath.Trim('/'),
        Username = Uri.UnescapeDataString(userInfo[0]),
        Password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : string.Empty,
        SslMode = SslMode.Require,
    }.ConnectionString;
}
if (!string.IsNullOrWhiteSpace(postgresConnectionString))
{
    var connectionBuilder = new NpgsqlConnectionStringBuilder(postgresConnectionString)
    {
        Timeout = 30,
        CommandTimeout = 120,
        KeepAlive = 30,
        MaxPoolSize = 10,
    };
    postgresConnectionString = connectionBuilder.ConnectionString;
}
var usePostgres = !string.IsNullOrWhiteSpace(postgresConnectionString);
var dataProfile = Environment.GetEnvironmentVariable("UBND_KTYTE_DATA_PROFILE");
var configuredDataDirectory = Environment.GetEnvironmentVariable("UBND_KTYTE_DATA_DIR");
string dataDirectory;

if (string.Equals(dataProfile, "web", StringComparison.OrdinalIgnoreCase))
{
    // Web local must never inherit the desktop data directory.
    dataDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "UBND_KTYTE",
        "web"
    );
}
else if (!string.IsNullOrWhiteSpace(configuredDataDirectory))
{
    dataDirectory = configuredDataDirectory;
}
else
{
    dataDirectory = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "UBND_KTYTE"
    );
}

Directory.CreateDirectory(dataDirectory);
var databasePath = Path.Combine(dataDirectory, "app2026.db");
Console.WriteLine($"SQLite database path: {databasePath}");

builder.Services.AddControllers();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    if (usePostgres)
    {
        options.UseNpgsql(postgresConnectionString, npgsqlOptions =>
            npgsqlOptions.EnableRetryOnFailure(
                maxRetryCount: 5,
                maxRetryDelay: TimeSpan.FromSeconds(10),
                errorCodesToAdd: null));
    }
    else
    {
        var connection = new SqliteConnection($"Data Source={databasePath}");
        connection.CreateFunction<string, string>(
            "unicode_lower",
            value => value?.ToLowerInvariant() ?? string.Empty
        );
        options.UseSqlite(connection, contextOwnsConnection: true);
    }
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", p =>
        p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
    };
});

builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var sqliteImportPath = Environment.GetEnvironmentVariable("IMPORT_SQLITE_PATH");
    if (db.Database.IsNpgsql())
    {
        var schemaScript = db.Database.GenerateCreateScript()
            .Replace("CREATE TABLE \"", "CREATE TABLE IF NOT EXISTS \"")
            .Replace("CREATE UNIQUE INDEX \"", "CREATE UNIQUE INDEX IF NOT EXISTS \"")
            .Replace("CREATE INDEX \"", "CREATE INDEX IF NOT EXISTS \"");
        db.Database.ExecuteSqlRaw(schemaScript);
    }
    else
        db.Database.EnsureCreated();

    if (db.Database.IsNpgsql())
    {
        db.Database.ExecuteSqlRaw("""
            ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "Phone" text NOT NULL DEFAULT '';
            ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "ObjectType" text NOT NULL DEFAULT '';
            ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "PhoneNumber" text NOT NULL DEFAULT '';
            ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "Address" text NOT NULL DEFAULT '';
            ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "Email" text NOT NULL DEFAULT '';
            ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "TaxCode" text NOT NULL DEFAULT '';
            ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "ExaminationDate" timestamp without time zone NOT NULL DEFAULT TIMESTAMP '0001-01-01 00:00:00';
            ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "CitizenIdIssueDate" timestamp without time zone NULL;
            ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "ExaminationPlace" text NOT NULL DEFAULT '';
            ALTER TABLE "Customers" ADD COLUMN IF NOT EXISTS "BirthDate" timestamp without time zone NULL;
            """);
        db.Database.ExecuteSqlRaw("""
            CREATE OR REPLACE FUNCTION unicode_lower(value text)
            RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
            AS 'SELECT lower(value);';
            """);

        sqliteImportPath = Environment.GetEnvironmentVariable("IMPORT_SQLITE_PATH");
        if (!string.IsNullOrWhiteSpace(sqliteImportPath))
        {
            await SqliteToPostgresImporter.ImportAsync(
                sqliteImportPath,
                db,
                scope.ServiceProvider.GetRequiredService<ILoggerFactory>()
                    .CreateLogger("SqliteToPostgresImporter"));
        }
    }

    if (db.Database.IsSqlite())
    {
    using (var command = db.Database.GetDbConnection().CreateCommand())
    {
        command.CommandText = "PRAGMA table_info('Customers');";
        db.Database.OpenConnection();
        var hasBirthDateColumn = false;
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                if (string.Equals(reader.GetString(1), "BirthDate", StringComparison.OrdinalIgnoreCase))
                {
                    hasBirthDateColumn = true;
                    break;
                }
            }
        }
        db.Database.CloseConnection();

        if (!hasBirthDateColumn)
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE Customers ADD COLUMN BirthDate TEXT NULL;");
        }
    }

    using (var command = db.Database.GetDbConnection().CreateCommand())
    {
        command.CommandText = "PRAGMA table_info('Customers');";
        db.Database.OpenConnection();
        var hasPhoneNumberColumn = false;
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                if (string.Equals(reader.GetString(1), "PhoneNumber", StringComparison.OrdinalIgnoreCase))
                {
                    hasPhoneNumberColumn = true;
                    break;
                }
            }
        }
        db.Database.CloseConnection();

        if (!hasPhoneNumberColumn)
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE Customers ADD COLUMN PhoneNumber TEXT NOT NULL DEFAULT '';");
        }
    }

    using (var command = db.Database.GetDbConnection().CreateCommand())
    {
        command.CommandText = "PRAGMA table_info('Customers');";
        db.Database.OpenConnection();
        var hasObjectTypeColumn = false;
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                if (string.Equals(reader.GetString(1), "ObjectType", StringComparison.OrdinalIgnoreCase))
                {
                    hasObjectTypeColumn = true;
                    break;
                }
            }
        }
        db.Database.CloseConnection();

        if (!hasObjectTypeColumn)
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE Customers ADD COLUMN ObjectType TEXT NOT NULL DEFAULT '';");
        }
    }

    db.Database.ExecuteSqlRaw(@"CREATE TABLE IF NOT EXISTS CatalogItems (
        Id INTEGER NOT NULL CONSTRAINT PK_CatalogItems PRIMARY KEY AUTOINCREMENT,
        Category TEXT NOT NULL,
        Name TEXT NOT NULL,
        IsDefault INTEGER NOT NULL DEFAULT 0
    );");

    using (var command = db.Database.GetDbConnection().CreateCommand())
    {
        command.CommandText = "PRAGMA table_info('CatalogItems');";
        db.Database.OpenConnection();
        var hasDefaultColumn = false;
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                if (string.Equals(reader.GetString(1), "IsDefault", StringComparison.OrdinalIgnoreCase))
                {
                    hasDefaultColumn = true;
                    break;
                }
            }
        }
        db.Database.CloseConnection();

        if (!hasDefaultColumn)
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE CatalogItems ADD COLUMN IsDefault INTEGER NOT NULL DEFAULT 0;");
        }
    }
    db.Database.ExecuteSqlRaw("CREATE UNIQUE INDEX IF NOT EXISTS IX_CatalogItems_Category_Name ON CatalogItems (Category, Name);");
    using (var command = db.Database.GetDbConnection().CreateCommand())
    {
        command.CommandText = "PRAGMA table_info('Customers');";
        db.Database.OpenConnection();
        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read()) columns.Add(reader.GetString(1));
        }
        db.Database.CloseConnection();
        if (!columns.Contains("CitizenIdIssueDate"))
            db.Database.ExecuteSqlRaw("ALTER TABLE Customers ADD COLUMN CitizenIdIssueDate TEXT NULL;");
        if (!columns.Contains("ExaminationPlace"))
            db.Database.ExecuteSqlRaw("ALTER TABLE Customers ADD COLUMN ExaminationPlace TEXT NOT NULL DEFAULT '';");
    }
    db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Customers_Code ON Customers (Code);");
    db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Customers_ExaminationDate ON Customers (ExaminationDate);");
    db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_Customers_Name ON Customers (Name);");
    db.Database.ExecuteSqlRaw(@"CREATE TABLE IF NOT EXISTS MedicalRecords (
        Id INTEGER NOT NULL CONSTRAINT PK_MedicalRecords PRIMARY KEY AUTOINCREMENT,
        SequenceNumber INTEGER NULL,
        PatientId TEXT NOT NULL,
        FullName TEXT NOT NULL,
        DateOfBirth TEXT NULL,
        Gender TEXT NOT NULL,
        PhoneNumber TEXT NOT NULL,
        CitizenId TEXT NOT NULL,
        HealthInsuranceNumber TEXT NOT NULL,
        Address TEXT NOT NULL,
        Note TEXT NOT NULL,
        SourceFileName TEXT NOT NULL,
        ImportedAt TEXT NOT NULL
    );");
    // PID của dữ liệu y bạ được phép trùng theo yêu cầu import nguyên trạng.
    db.Database.ExecuteSqlRaw("DROP INDEX IF EXISTS IX_MedicalRecords_PatientId;");
    db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_MedicalRecords_PatientId ON MedicalRecords (PatientId);");
    db.Database.ExecuteSqlRaw(@"CREATE TABLE IF NOT EXISTS TanChauInpatientRecords (
        Id INTEGER NOT NULL CONSTRAINT PK_TanChauInpatientRecords PRIMARY KEY AUTOINCREMENT,
        Stt TEXT NOT NULL, HoTen TEXT NOT NULL, SoCccd TEXT NOT NULL, NgaySinh TEXT NOT NULL,
        GioiTinh TEXT NOT NULL, MaQuocTich TEXT NOT NULL, MaDanToc TEXT NOT NULL, DiaChi TEXT NOT NULL,
        MaHuyenCuTru TEXT NOT NULL, MaXaCuTru TEXT NOT NULL, DienThoai TEXT NOT NULL, MaTheBhyt TEXT NOT NULL,
        MaDkbd TEXT NOT NULL, GtTheTu TEXT NOT NULL, GtTheDen TEXT NOT NULL, NgayMienCct TEXT NOT NULL,
        LyDoVv TEXT NOT NULL, LyDoVnt TEXT NOT NULL, MaLyDoVnt TEXT NOT NULL, ChanDoanVao TEXT NOT NULL,
        ChanDoanRv TEXT NOT NULL, MaBenhChinh TEXT NOT NULL, MaBenhKt TEXT NOT NULL, MaBenhYhct TEXT NOT NULL,
        MaPtttQt TEXT NOT NULL, MaNoiDi TEXT NOT NULL, MaNoiDen TEXT NOT NULL, SoNgayDtri TEXT NOT NULL,
        SourceFileName TEXT NOT NULL, ImportedAt TEXT NOT NULL
    );");
    db.Database.ExecuteSqlRaw(@"CREATE TABLE IF NOT EXISTS TanChauOutpatientRecords (
        Id INTEGER NOT NULL CONSTRAINT PK_TanChauOutpatientRecords PRIMARY KEY AUTOINCREMENT,
        HoTen TEXT NOT NULL, NamSinh TEXT NOT NULL, GioiTinh TEXT NOT NULL,
        Cccd TEXT NOT NULL, DiaChi TEXT NOT NULL,
        SourceFileName TEXT NOT NULL, ImportedAt TEXT NOT NULL
    );");
    db.Database.ExecuteSqlRaw(@"CREATE TABLE IF NOT EXISTS CampaignHamletStats (
        Id INTEGER NOT NULL CONSTRAINT PK_CampaignHamletStats PRIMARY KEY AUTOINCREMENT,
        HamletId INTEGER NOT NULL,
        TargetCount INTEGER NOT NULL DEFAULT 0,
        InformationIssuedCount INTEGER NOT NULL DEFAULT 0
    );");
    db.Database.ExecuteSqlRaw(@"CREATE TABLE IF NOT EXISTS CommuneSubjectRecords (
        Id INTEGER NOT NULL CONSTRAINT PK_CommuneSubjectRecords PRIMARY KEY AUTOINCREMENT,
        Stt TEXT NOT NULL, HoTen TEXT NOT NULL, NgaySinh TEXT NOT NULL, Cccd TEXT NOT NULL, DiaChi TEXT NOT NULL,
        DoiTuong TEXT NOT NULL, SourceFileName TEXT NOT NULL, ImportedAt TEXT NOT NULL
    );");
    db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_CommuneSubjectRecords_DoiTuong ON CommuneSubjectRecords (DoiTuong);");
    db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_CommuneSubjectRecords_Cccd ON CommuneSubjectRecords (Cccd);");
    db.Database.ExecuteSqlRaw("CREATE INDEX IF NOT EXISTS IX_CommuneSubjectRecords_HoTen ON CommuneSubjectRecords (HoTen);");
    using (var command = db.Database.GetDbConnection().CreateCommand())
    {
        command.CommandText = "PRAGMA table_info('CommuneSubjectRecords');";
        db.Database.OpenConnection();
        var hasNgaySinhColumn = false;
        using (var reader = command.ExecuteReader())
        {
            while (reader.Read())
            {
                if (string.Equals(reader.GetString(1), "NgaySinh", StringComparison.OrdinalIgnoreCase))
                {
                    hasNgaySinhColumn = true;
                    break;
                }
            }
        }
        db.Database.CloseConnection();
        if (!hasNgaySinhColumn)
        {
            db.Database.ExecuteSqlRaw("ALTER TABLE CommuneSubjectRecords ADD COLUMN NgaySinh TEXT NOT NULL DEFAULT '';");
        }
    }
    db.Database.ExecuteSqlRaw("CREATE UNIQUE INDEX IF NOT EXISTS IX_CampaignHamletStats_HamletId ON CampaignHamletStats (HamletId);");
    }

    db.CatalogItems.Where(x => x.Category == "address").ExecuteDelete();

    var catalogDefaults = new Dictionary<string, string[]>
    {
        ["objectType"] = new[] { "CÔNG CHỨC", "DÂN QUÂN", "GIÁO VIÊN", "NGƯỜI CAO TUỔI", "NGƯỜI DÂN", "THƯƠNG BINH", "KHUYẾT TẬT" },
        ["occupation"] = new[] { "NÔNG DÂN", "CÔNG NHÂN", "BUÔN BÁN", "KINH DOANH", "CÁN BỘ, CÔNG CHỨC", "VIÊN CHỨC", "GIÁO VIÊN", "LAO ĐỘNG TỰ DO", "NỘI TRỢ", "HỌC SINH, SINH VIÊN" },
        ["examinationPlace"] = new[] { "TRẠM Y TẾ XÃ", "TRUNG TÂM Y TẾ HUYỆN", "BỆNH VIỆN ĐA KHOA", "TỰ NGUYỆN", "NƠI KHÁC" }
    };

    foreach (var (category, names) in catalogDefaults)
    {
        if (!db.CatalogItems.Any(x => x.Category == category))
        {
            db.CatalogItems.AddRange(names.Select(name => new backend.Models.CatalogItem { Category = category, Name = name }));
        }
    }
    db.SaveChanges();

    if (!db.Users.Any())
    {
        db.Users.Add(new backend.Models.User
        {
            Username = "admin",
            Password = BCrypt.Net.BCrypt.HashPassword("123456"),
            FullName = "Quản trị viên",
            Role = "Admin"
        });
        db.SaveChanges();
    }
}

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
