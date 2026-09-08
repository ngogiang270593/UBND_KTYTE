namespace backend.Models
{
    public class PrintTemplate
    {
        public int Id { get; set; }

        public string TemplateName { get; set; } = "";

        public string TemplateType { get; set; } = "";

        public string FileName { get; set; } = "";

        public string FilePath { get; set; } = "";

        public DateTime UploadedAt { get; set; } = DateTime.Now;
    }
}