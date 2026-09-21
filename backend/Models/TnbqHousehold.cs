namespace backend.Models;

public class TnbqHousehold
{
    public int Id { get; set; }
    public int Year { get; set; }
    public string HouseNumber { get; set; } = "";
    public string HouseholdNumber { get; set; } = "";
    public string HeadName { get; set; } = "";
    public string Address { get; set; } = "";
    public int Members { get; set; }
    public string Note { get; set; } = "";
    public string Province { get; set; } = "";
    public string Commune { get; set; } = "";
    public string Hamlet { get; set; } = "";
    public string AreaType { get; set; } = "";
    public string Preparer { get; set; } = "";
    public string Phone { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}
