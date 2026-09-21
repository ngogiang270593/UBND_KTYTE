namespace backend.Models;

public class TnbqSurveySalary
{
    public int SurveyId { get; set; }
    public bool? HasIncome { get; set; }
    public string RowsJson { get; set; } = "[]";
}
