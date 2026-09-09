using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Data
{
    public class AppDbContext : DbContext
    {
        [DbFunction("unicode_lower", IsBuiltIn = true)]
        public static string UnicodeLower(string value)
            => throw new NotSupportedException("Chỉ dùng trong truy vấn cơ sở dữ liệu.");

        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }

        public DbSet<Employee> Employees { get; set; }

        public DbSet<Customer> Customers { get; set; }

        public DbSet<ImportedPurchaseRow> ImportedPurchaseRows { get; set; }
        public DbSet<PrintTemplate> PrintTemplates { get; set; }
        public DbSet<CatalogItem> CatalogItems { get; set; }
        public DbSet<CampaignHamletStat> CampaignHamletStats { get; set; }
        public DbSet<MedicalRecord> MedicalRecords { get; set; }
        public DbSet<TanChauInpatientRecord> TanChauInpatientRecords { get; set; }
        public DbSet<TanChauOutpatientRecord> TanChauOutpatientRecords { get; set; }
        public DbSet<CommuneSubjectRecord> CommuneSubjectRecords { get; set; }

        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            NormalizeDateTimes();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(
            bool acceptAllChangesOnSuccess,
            CancellationToken cancellationToken = default
        )
        {
            NormalizeDateTimes();
            return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        }

        private void NormalizeDateTimes()
        {
            foreach (var entry in ChangeTracker.Entries())
            {
                foreach (var property in entry.Properties)
                {
                    if (property.CurrentValue is DateTime value)
                    {
                        property.CurrentValue = value.Kind == DateTimeKind.Local
                            ? value.ToUniversalTime()
                            : DateTime.SpecifyKind(value, DateTimeKind.Utc);
                    }
                }
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<CatalogItem>()
                .HasIndex(x => new { x.Category, x.Name })
                .IsUnique();

            modelBuilder.Entity<CampaignHamletStat>()
                .HasIndex(x => x.HamletId)
                .IsUnique();

            modelBuilder.Entity<MedicalRecord>()
                .HasIndex(x => x.PatientId)
                .IsUnique(false);

            // unique customer code
            // modelBuilder.Entity<Customer>()
            //     .HasIndex(x => x.Code)
            //     .IsUnique();

            // decimal precision
            modelBuilder.Entity<ImportedPurchaseRow>()
                .Property(x => x.WaterKg)
                .HasPrecision(18, 2);

            modelBuilder.Entity<ImportedPurchaseRow>()
                .Property(x => x.Tcs)
                .HasPrecision(18, 2);

            modelBuilder.Entity<ImportedPurchaseRow>()
                .Property(x => x.QkKg)
                .HasPrecision(18, 2);

            modelBuilder.Entity<ImportedPurchaseRow>()
                .Property(x => x.WaterPrice)
                .HasPrecision(18, 2);

            modelBuilder.Entity<ImportedPurchaseRow>()
                .Property(x => x.WaterAmount)
                .HasPrecision(18, 2);

            modelBuilder.Entity<ImportedPurchaseRow>()
                .Property(x => x.ScrapKg)
                .HasPrecision(18, 2);

            modelBuilder.Entity<ImportedPurchaseRow>()
                .Property(x => x.ScrapPrice)
                .HasPrecision(18, 2);

            modelBuilder.Entity<ImportedPurchaseRow>()
                .Property(x => x.ScrapAmount)
                .HasPrecision(18, 2);

            modelBuilder.Entity<ImportedPurchaseRow>()
                .Property(x => x.TotalAmount)
                .HasPrecision(18, 2);
        }
    }
}
