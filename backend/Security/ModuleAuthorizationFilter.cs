using backend.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;

namespace backend.Security;

// Read current database permissions; client-supplied modules and JWT roles are not authoritative.
public class ModuleAuthorizationFilter(AppDbContext db) : IAsyncAuthorizationFilter
{
    public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
    {
        if (context.ActionDescriptor is not ControllerActionDescriptor action) return;
        var controller = action.ControllerName;
        if (controller == "Auth" && action.ActionName == "Login") return;
        var username = context.HttpContext.User.Identity?.Name;
        if (context.HttpContext.User.Identity?.IsAuthenticated != true || string.IsNullOrEmpty(username))
        {
            context.Result = new UnauthorizedResult();
            return;
        }
        var user = await db.Users.AsNoTracking().SingleOrDefaultAsync(x => x.Username == username);
        if (user == null)
        {
            context.Result = new UnauthorizedResult();
            return;
        }
        var profile = await ModuleAccess.GetProfile(db, user);
        context.HttpContext.Items["AccessProfile"] = profile;
        if (!profile.IsActive)
        {
            context.Result = new ObjectResult(new { message = "Tài khoản đã bị khóa." }) { StatusCode = 403 };
            return;
        }
        if (profile.IsSystemAdmin || (controller == "Auth" && action.ActionName is "Me" or "ChangePassword")) return;

        var read = HttpMethods.IsGet(context.HttpContext.Request.Method);
        string[] required = controller switch
        {
            "TnbqHouseholds" or "TnbqSurveys" or "TnbqCatalog" => ["tnbq"],
            "CampaignStats" => ["campaign"],
            "Customers" => read && action.ActionName == "GetAll" ? ["health", "campaign"] : ["health"],
            "CatalogItems" => read ? ["health", "campaign", "data-processing", "people"] : ["health"],
            "ImportData" => read ? ["health", "stats"] : ["health"],
            "ExcelTemplate" or "PrintTemplates" => ["health"],
            "PrintVoucher" => action.ActionName switch
            {
                "GetCustomers" or "ExportCustomers" => ["health", "data-processing"],
                "UpdateAddressesFromCommuneSubjects" or "GetObjectTypeMismatches" or
                "UpdateObjectType" or "UpdateObjectTypes" => ["data-processing"],
                "Export" => ["health"],
                _ => []
            },
            "TanChauInpatient" or "TanChauOutpatient" => read ? ["hospital", "stats"] : ["hospital"],
            "MedicalRecords" => read ? ["record", "stats"] : ["record"],
            "CommuneSubjects" => ["people"],
            "TanHoa" or "TanHoaNk" or "TanHoaPaidKsk" or "TanHoaAdmissionTc" => read ? ["tan-hoa", "stats"] : ["tan-hoa"],
            // User administration, legacy setup and unmapped endpoints are system-admin only.
            _ => []
        };
        if (!required.Any(profile.Modules.Contains))
            context.Result = new ObjectResult(new { message = "Bạn không có quyền sử dụng chức năng này." }) { StatusCode = 403 };
    }
}

