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

        public DbSet<TnbqHousehold> TnbqHouseholds => Set<TnbqHousehold>();
        public DbSet<TnbqSurvey> TnbqSurveys => Set<TnbqSurvey>();
        public DbSet<TnbqCommune> TnbqCommunes => Set<TnbqCommune>();
        public DbSet<TnbqHamlet> TnbqHamlets => Set<TnbqHamlet>();

        public DbSet<User> Users { get; set; }
        public DbSet<ElderlyRecord> ElderlyRecords => Set<ElderlyRecord>();
        public DbSet<UpdatedInformationRecord> UpdatedInformationRecords => Set<UpdatedInformationRecord>();
        public DbSet<UserModuleAccess> UserModuleAccesses => Set<UserModuleAccess>();
        public DbSet<OfficeMeeting> OfficeMeetings => Set<OfficeMeeting>();
        public DbSet<TanHoaRecord> TanHoaRecords { get; set; }
        public DbSet<TanHoaNkRecord> TanHoaNkRecords { get; set; }
        public DbSet<TanHoaPaidKskRecord> TanHoaPaidKskRecords { get; set; }
        public DbSet<TanHoaAdmissionTcRecord> TanHoaAdmissionTcRecords { get; set; }

        public DbSet<Employee> Employees { get; set; }

        public DbSet<Customer> Customers { get; set; }
        public DbSet<ExaminationNumber> ExaminationNumbers { get; set; }

        public DbSet<ImportedPurchaseRow> ImportedPurchaseRows { get; set; }
        public DbSet<PrintTemplate> PrintTemplates { get; set; }
        public DbSet<CatalogItem> CatalogItems { get; set; }
        public DbSet<CampaignHamletStat> CampaignHamletStats { get; set; }
        public DbSet<MedicalRecord> MedicalRecords { get; set; }
        public DbSet<TanChauInpatientRecord> TanChauInpatientRecords { get; set; }
        public DbSet<TanChauOutpatientRecord> TanChauOutpatientRecords { get; set; }
        public DbSet<CommuneSubjectRecord> CommuneSubjectRecords { get; set; }
        public DbSet<TtytKvTcRecord> TtytKvTcRecords { get; set; }

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
            modelBuilder.Entity<UserModuleAccess>().HasKey(x => x.UserId);
            modelBuilder.Entity<UserModuleAccess>().HasOne<User>().WithOne()
                .HasForeignKey<UserModuleAccess>(x => x.UserId).OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TnbqSurvey>().HasIndex(x => new { x.Year, x.IdentityKey }).IsUnique();
            modelBuilder.Entity<TnbqCommune>().HasIndex(x => x.Code).IsUnique();
            modelBuilder.Entity<TnbqHamlet>().HasIndex(x => new { x.CommuneId, x.Code }).IsUnique();
            modelBuilder.Entity<TnbqHamlet>().HasOne(x => x.Commune).WithMany(x => x.Hamlets)
                .HasForeignKey(x => x.CommuneId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<TnbqSurvey>().Property(x => x.Revision).IsConcurrencyToken();
            modelBuilder.Entity<TnbqSurveyCrops>().HasKey(x => x.SurveyId);
            modelBuilder.Entity<TnbqSurvey>().HasOne(x => x.Crops).WithOne()
                .HasForeignKey<TnbqSurveyCrops>(x => x.SurveyId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<TnbqSurveyLivestock>().HasKey(x => x.SurveyId);
            modelBuilder.Entity<TnbqSurvey>().HasOne(x => x.Livestock).WithOne()
                .HasForeignKey<TnbqSurveyLivestock>(x => x.SurveyId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<TnbqSurveyForestry>().HasKey(x => x.SurveyId);
            modelBuilder.Entity<TnbqSurvey>().HasOne(x => x.Forestry).WithOne()
                .HasForeignKey<TnbqSurveyForestry>(x => x.SurveyId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<TnbqSurveyAquaculture>().HasKey(x => x.SurveyId);
            modelBuilder.Entity<TnbqSurvey>().HasOne(x => x.Aquaculture).WithOne()
                .HasForeignKey<TnbqSurveyAquaculture>(x => x.SurveyId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<TnbqSurveyBusiness>().HasKey(x => x.SurveyId);
            modelBuilder.Entity<TnbqSurvey>().HasOne(x => x.Business).WithOne()
                .HasForeignKey<TnbqSurveyBusiness>(x => x.SurveyId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<TnbqSurveyOtherIncome>().HasKey(x => x.SurveyId);
            modelBuilder.Entity<TnbqSurvey>().HasOne(x => x.OtherIncome).WithOne()
                .HasForeignKey<TnbqSurveyOtherIncome>(x => x.SurveyId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<TnbqSurveySalary>().HasKey(x => x.SurveyId);
            modelBuilder.Entity<TnbqSurvey>().HasOne(x => x.Salary).WithOne()
                .HasForeignKey<TnbqSurveySalary>(x => x.SurveyId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<TnbqHousehold>().HasIndex(x => x.Year);
            modelBuilder.Entity<TnbqHousehold>().HasIndex(x => new { x.Year, x.Hamlet });

            modelBuilder.Entity<ExaminationNumber>().HasKey(x => x.CustomerId);
            modelBuilder.Entity<ExaminationNumber>()
                .HasIndex(x => new { x.ExaminationDate, x.Number }).IsUnique();
            modelBuilder.Entity<Customer>()
                .HasOne(x => x.ExaminationNumber).WithOne()
                .HasForeignKey<ExaminationNumber>(x => x.CustomerId)
                .OnDelete(DeleteBehavior.Cascade);

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

