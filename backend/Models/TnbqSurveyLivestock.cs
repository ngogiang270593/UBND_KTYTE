namespace backend.Models;

public class TnbqSurveyLivestock
{
    public int SurveyId { get; set; }
    public bool? HasIncome { get; set; }
    public string RowsJson { get; set; } = "[]";
}

