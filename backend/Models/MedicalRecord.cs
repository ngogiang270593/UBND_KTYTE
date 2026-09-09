namespace backend.Models
{
    public class MedicalRecord
    {
        public int Id { get; set; }
        public int? SequenceNumber { get; set; }
        public string PatientId { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public DateTime? DateOfBirth { get; set; }
        public string Gender { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public string CitizenId { get; set; } = string.Empty;
        public string HealthInsuranceNumber { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
        public string SourceFileName { get; set; } = string.Empty;
        public DateTime ImportedAt { get; set; } = DateTime.UtcNow;
    }
}
