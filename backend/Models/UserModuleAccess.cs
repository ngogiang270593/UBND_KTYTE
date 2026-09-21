namespace backend.Models;

public class UserModuleAccess
{
    public int UserId { get; set; }
    public string ModuleIds { get; set; } = "[]";
    public bool IsActive { get; set; } = true;
}
