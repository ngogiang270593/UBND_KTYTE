namespace backend.Models;

public class TnbqSurvey
{
    public int Id { get; set; }
    public TnbqSurveySalary? Salary { get; set; }
    public TnbqSurveyCrops? Crops { get; set; }
    public TnbqSurveyLivestock? Livestock { get; set; }
    public TnbqSurveyForestry? Forestry { get; set; }
    public TnbqSurveyAquaculture? Aquaculture { get; set; }
    public TnbqSurveyBusiness? Business { get; set; }
    public TnbqSurveyOtherIncome? OtherIncome { get; set; }
    public int Year { get; set; }
    public string Commune { get; set; } = "";
    public string CommuneCode { get; set; } = "";
    public string Hamlet { get; set; } = "";
    public string HamletCode { get; set; } = "";
    public string HouseholdNumber { get; set; } = "";
    public string HeadName { get; set; } = "";
    public string Address { get; set; } = "";
    public string Phone { get; set; } = "";
    public int Members { get; set; }
    public string IdentityKey { get; set; } = "";
    public int Revision { get; set; } = 1;
    public bool IsInvalid { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public string UpdatedBy { get; set; } = "";
}

