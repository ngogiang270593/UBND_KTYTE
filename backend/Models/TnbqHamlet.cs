using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class TnbqHamlet
{
    public int Id { get; set; }
    public int CommuneId { get; set; }
    public TnbqCommune? Commune { get; set; }
    [Required, StringLength(150)] public string Name { get; set; } = "";
    [Required, StringLength(20)] public string Code { get; set; } = "";
    public bool IsDefault { get; set; }
}
