namespace backend.Models;

public class TnbqSurveyForestry
{
    public int SurveyId { get; set; }
    public bool? HasIncome { get; set; }
    public string RowsJson { get; set; } = "[]";
}
