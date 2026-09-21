using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public class TnbqCommune
{
    public int Id { get; set; }
    [Required, StringLength(150)] public string Name { get; set; } = "";
    [Required, StringLength(20)] public string Code { get; set; } = "";
    [Required, StringLength(150)] public string Province { get; set; } = "";
    public bool IsDefault { get; set; }
    public List<TnbqHamlet> Hamlets { get; set; } = [];
}
