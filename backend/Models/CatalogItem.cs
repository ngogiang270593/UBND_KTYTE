using System.ComponentModel.DataAnnotations;

namespace backend.Models
{
    public class CatalogItem
    {
        public int Id { get; set; }

        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        public bool IsDefault { get; set; }
    }
}
