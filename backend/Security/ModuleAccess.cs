using System.Text.Json;
using backend.Data;
using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Security;

public static class ModuleAccess
{
    public const string SystemAdminRole = "SystemAdmin";
    public static readonly string[] ModuleIds =
        ["tnbq", "health", "campaign", "data-processing", "stats", "hospital", "record", "people", "tan-hoa"];

    public static async Task<AccessProfile> GetProfile(AppDbContext db, User user)
    {
        var access = await db.UserModuleAccesses.AsNoTracking().SingleOrDefaultAsync(x => x.UserId == user.Id);
        var isSystemAdmin = user.Role == SystemAdminRole;
        // Preserve existing administrator access until explicitly edited.
        var modules = isSystemAdmin || (access == null && user.Role == "Admin")
            ? ModuleIds
            : access == null ? [] : JsonSerializer.Deserialize<string[]>(access.ModuleIds) ?? [];
        return new AccessProfile(user.Id, user.Username, user.FullName, user.Role,
            access?.IsActive ?? true, isSystemAdmin, modules.Intersect(ModuleIds).ToArray());
    }
}

public record AccessProfile(int Id, string Username, string FullName, string Role,
    bool IsActive, bool IsSystemAdmin, string[] Modules);

