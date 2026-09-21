using System.ComponentModel.DataAnnotations;
using System.Text;
using System.Text.Json;
using backend.Data;
using backend.Forms;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TnbqSurveysController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery, Range(2000, 2100)] int year)
        => Ok(await db.TnbqSurveys.AsNoTracking().Where(x => x.Year == year)
            .OrderByDescending(x => x.UpdatedAt).ThenByDescending(x => x.Id)
            .Select(x => new { x.Id, x.Year, x.Commune, x.Hamlet, x.HouseholdNumber,
                x.HeadName, x.Members, x.Revision, x.IsInvalid, x.UpdatedAt }).ToListAsync());

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Get(int id)
    {
        var item = await db.TnbqSurveys.AsNoTracking().Include(x => x.Salary).Include(x => x.Crops).Include(x => x.Livestock).Include(x => x.Forestry).Include(x => x.Aquaculture).Include(x => x.Business).Include(x => x.OtherIncome).SingleOrDefaultAsync(x => x.Id == id);
        return item == null ? NotFound() : Ok(Detail(item));
    }

    [HttpPost]
    public Task<IActionResult> Create(SaveTnbqSurveyRequest request) => Save(null, request);

    [HttpPut("{id:int}")]
    public Task<IActionResult> Update(int id, SaveTnbqSurveyRequest request) => Save(id, request);


    [HttpPatch("{id:int}/invalid")]
    public async Task<IActionResult> SetInvalid(int id, SetTnbqSurveyInvalidRequest request)
    {
        var item = await db.TnbqSurveys.SingleOrDefaultAsync(x => x.Id == id);
        if (item == null) return NotFound();
        if (request.Revision != item.Revision)
            return Conflict(new { message = "Phiếu đã được cập nhật ở phiên khác. Hãy tải lại danh sách trước khi thao tác." });

        item.IsInvalid = request.IsInvalid;
        item.Revision++;
        item.UpdatedAt = DateTime.UtcNow;
        item.UpdatedBy = User.Identity?.Name ?? "";
        await db.SaveChangesAsync();
        return Ok(new { item.Id, item.IsInvalid, item.Revision, item.UpdatedAt });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] int revision)
    {
        var item = await db.TnbqSurveys.SingleOrDefaultAsync(x => x.Id == id);
        if (item == null) return NotFound();
        if (revision != item.Revision)
            return Conflict(new { message = "Phiếu đã được cập nhật ở phiên khác. Hãy tải lại danh sách trước khi xóa." });

        db.TnbqSurveys.Remove(item);
        await db.SaveChangesAsync();
        return NoContent();
    }

    private async Task<IActionResult> Save(int? id, SaveTnbqSurveyRequest request)
    {
        var item = id.HasValue ? await db.TnbqSurveys.Include(x => x.Salary).Include(x => x.Crops).Include(x => x.Livestock).Include(x => x.Forestry).Include(x => x.Aquaculture).Include(x => x.Business).Include(x => x.OtherIncome).SingleOrDefaultAsync(x => x.Id == id) : new TnbqSurvey();
        if (item == null) return NotFound();
        if (id.HasValue && request.Revision != item.Revision)
            return Conflict(new { message = "Phiếu đã được cập nhật ở phiên khác. Hãy mở lại phiếu trước khi lưu." });

        // Omitted salary preserves older clients and existing Tab 1-only saves.
        var salary = request.Salary ?? ReadSalary(item);
        var salaryError = ValidateSalary(salary, request.Members);
        if (salaryError != null) return BadRequest(new { message = salaryError });
        if (request.Salary != null)
        {
            item.Salary ??= new TnbqSurveySalary();
            item.Salary.HasIncome = salary.HasIncome;
            item.Salary.RowsJson = JsonSerializer.Serialize(salary.Rows);
        }

        var crops = request.Crops ?? ReadCrops(item);
        var cropsError = TnbqCrops.Validate(crops);
        if (cropsError != null) return BadRequest(new { message = cropsError });
        if (request.Crops != null)
        {
            item.Crops ??= new TnbqSurveyCrops();
            item.Crops.HasIncome = crops.HasIncome;
            item.Crops.RowsJson = JsonSerializer.Serialize(crops.Rows);
        }

        var livestock = request.Livestock ?? ReadLivestock(item);
        var livestockError = TnbqLivestock.Validate(livestock);
        if (livestockError != null) return BadRequest(new { message = livestockError });
        if (request.Livestock != null)
        {
            item.Livestock ??= new TnbqSurveyLivestock();
            item.Livestock.HasIncome = livestock.HasIncome;
            item.Livestock.RowsJson = JsonSerializer.Serialize(livestock.Rows);
        }

        var forestry = request.Forestry ?? ReadForestry(item);
        var forestryError = TnbqForestry.Validate(forestry);
        if (forestryError != null) return BadRequest(new { message = forestryError });
        if (request.Forestry != null)
        {
            item.Forestry ??= new TnbqSurveyForestry();
            item.Forestry.HasIncome = forestry.HasIncome;
            item.Forestry.RowsJson = JsonSerializer.Serialize(forestry.Rows);
        }

        var aquaculture = request.Aquaculture ?? ReadAquaculture(item);
        var aquacultureError = TnbqAquaculture.Validate(aquaculture);
        if (aquacultureError != null) return BadRequest(new { message = aquacultureError });
        if (request.Aquaculture != null)
        {
            item.Aquaculture ??= new TnbqSurveyAquaculture();
            item.Aquaculture.HasIncome = aquaculture.HasIncome;
            item.Aquaculture.RowsJson = JsonSerializer.Serialize(aquaculture.Rows);
        }

        var business = request.Business ?? ReadBusiness(item);
        var businessError = TnbqBusiness.Validate(business);
        if (businessError != null) return BadRequest(new { message = businessError });
        if (request.Business != null)
        {
            item.Business ??= new TnbqSurveyBusiness();
            item.Business.HasIncome = business.HasIncome;
            item.Business.RowsJson = JsonSerializer.Serialize(business.Rows);
        }

        var otherIncome = request.OtherIncome ?? ReadOtherIncome(item);
        var otherIncomeError = TnbqOtherIncome.Validate(otherIncome);
        if (otherIncomeError != null) return BadRequest(new { message = otherIncomeError });
        if (request.OtherIncome != null)
        {
            item.OtherIncome ??= new TnbqSurveyOtherIncome();
            item.OtherIncome.DataJson = JsonSerializer.Serialize(otherIncome);
        }

        var key = JsonSerializer.Serialize(new[] { request.Commune.Trim(), request.Hamlet.Trim(), request.HouseholdNumber.Trim() }
            .Select(x => x.Normalize(NormalizationForm.FormC).ToUpperInvariant()));
        if (await db.TnbqSurveys.AnyAsync(x => x.Id != (id ?? 0) && x.Year == request.Year && x.IdentityKey == key))
            return Conflict(new { message = "Hộ này đã có phiếu trong năm đã chọn. Hãy mở phiếu đã lưu để chỉnh sửa." });

        item.Year = request.Year;
        item.Commune = request.Commune.Trim();
        item.CommuneCode = request.CommuneCode?.Trim() ?? "";
        item.Hamlet = request.Hamlet.Trim();
        item.HamletCode = request.HamletCode?.Trim() ?? "";
        item.HouseholdNumber = request.HouseholdNumber.Trim();
        item.HeadName = request.HeadName.Trim();
        item.Address = request.Address?.Trim() ?? "";
        item.Phone = request.Phone?.Trim() ?? "";
        item.Members = request.Members;
        item.IdentityKey = key;
        item.UpdatedAt = DateTime.UtcNow;
        item.UpdatedBy = User.Identity?.Name ?? "";
        if (!id.HasValue) { item.CreatedAt = item.UpdatedAt; db.TnbqSurveys.Add(item); }
        else item.Revision++;

        try { await db.SaveChangesAsync(); }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "Phiếu vừa được thay đổi. Hãy mở lại trước khi lưu." });
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "Không thể lưu phiếu. Vui lòng kiểm tra phiếu trùng và thử lại." });
        }
        return Ok(Detail(item));
    }

    private static SalaryRequest ReadSalary(TnbqSurvey item) => new()
    {
        HasIncome = item.Salary?.HasIncome,
        Rows = JsonSerializer.Deserialize<List<SalaryMember>>(item.Salary?.RowsJson ?? "[]") ?? []
    };

    private static string? ValidateSalary(SalaryRequest salary, int members)
    {
        if (salary.Rows.Any(row => row == null)) return "Dòng thành viên không hợp lệ.";
        if (salary.HasIncome != true && salary.Rows.Count > 0)
            return "Chỉ nhập bảng tiền lương khi chọn Có ở Câu 1.";
        if (salary.HasIncome == true && salary.Rows.Count == 0)
            return "Mục 1: nhập ít nhất một thành viên khi chọn Có.";
        if (salary.Rows.Count > members) return "Số thành viên ở Mục 1 vượt tổng số thành viên của hộ.";
        if (salary.Rows.Select(x => x.Code.Trim()).Distinct(StringComparer.OrdinalIgnoreCase).Count() != salary.Rows.Count)
            return "Mã thành viên ở Mục 1 không được trùng.";
        foreach (var row in salary.Rows)
        {
            if (string.IsNullOrWhiteSpace(row.Code) || string.IsNullOrWhiteSpace(row.Name))
                return "Mục 1: nhập mã thành viên và họ tên.";
            if (row.Wage < 0 || row.Pension < 0 || row.Wage > 1000000000m || row.Pension > 1000000000m
                || decimal.Round(row.Wage, 3) != row.Wage || decimal.Round(row.Pension, 3) != row.Pension)
                return "Số tiền phải từ 0 đến 1.000.000.000 nghìn đồng, tối đa 3 chữ số thập phân.";
            row.Code = row.Code.Trim(); row.Name = row.Name.Trim();
        }
        return null;
    }

    private static object SalaryDetail(TnbqSurvey item)
    {
        var salary = ReadSalary(item);
        var wageTotal = salary.HasIncome == true ? salary.Rows.Sum(x => x.Wage) : 0;
        var pensionTotal = salary.HasIncome == true ? salary.Rows.Sum(x => x.Pension) : 0;
        return new { salary.HasIncome, salary.Rows, wageTotal, pensionTotal, total = wageTotal + pensionTotal };
    }

    private static CropsRequest ReadCrops(TnbqSurvey item) => new()
    {
        HasIncome = item.Crops?.HasIncome,
        Rows = JsonSerializer.Deserialize<List<CropRow>>(item.Crops?.RowsJson ?? "[]") ?? []
    };
    private static object CropsDetail(TnbqSurvey item)
    {
        var crops = ReadCrops(item);
        var totals = TnbqCrops.Totals(crops);
        return new { crops.HasIncome, crops.Rows, totals, total = totals.Income };
    }

    private static LivestockRequest ReadLivestock(TnbqSurvey item) => new()
    {
        HasIncome = item.Livestock?.HasIncome,
        Rows = JsonSerializer.Deserialize<List<LivestockRow>>(item.Livestock?.RowsJson ?? "[]") ?? []
    };
    private static object LivestockDetail(TnbqSurvey item)
    {
        var livestock = ReadLivestock(item);
        var totals = TnbqLivestock.Totals(livestock);
        return new { livestock.HasIncome, livestock.Rows, totals, total = totals.Income };
    }

    private static ForestryRequest ReadForestry(TnbqSurvey item) => new()
    {
        HasIncome = item.Forestry?.HasIncome,
        Rows = JsonSerializer.Deserialize<List<ForestryRow>>(item.Forestry?.RowsJson ?? "[]") ?? []
    };
    private static object ForestryDetail(TnbqSurvey item)
    {
        var forestry = ReadForestry(item);
        var totals = TnbqForestry.Totals(forestry);
        return new { forestry.HasIncome, forestry.Rows, totals, total = totals.Income };
    }

    private static AquacultureRequest ReadAquaculture(TnbqSurvey item) => new()
    {
        HasIncome = item.Aquaculture?.HasIncome,
        Rows = JsonSerializer.Deserialize<List<AquacultureRow>>(item.Aquaculture?.RowsJson ?? "[]") ?? []
    };
    private static object AquacultureDetail(TnbqSurvey item)
    {
        var aquaculture = ReadAquaculture(item);
        var totals = TnbqAquaculture.Totals(aquaculture);
        return new { aquaculture.HasIncome, aquaculture.Rows, totals, total = totals.Income };
    }

    private static BusinessRequest ReadBusiness(TnbqSurvey item) => new()
    {
        HasIncome = item.Business?.HasIncome,
        Rows = JsonSerializer.Deserialize<List<BusinessRow>>(item.Business?.RowsJson ?? "[]") ?? []
    };
    private static object BusinessDetail(TnbqSurvey item)
    {
        var business = ReadBusiness(item);
        var totals = TnbqBusiness.Totals(business);
        return new { business.HasIncome, business.Rows, totals, total = totals.Income };
    }

    private static OtherIncomeRequest ReadOtherIncome(TnbqSurvey item)
        => JsonSerializer.Deserialize<OtherIncomeRequest>(item.OtherIncome?.DataJson ?? "{}") ?? new();
    private static object OtherIncomeDetail(TnbqSurvey item)
    {
        var otherIncome = ReadOtherIncome(item);
        var totals = TnbqOtherIncome.Totals(otherIncome);
        return new { otherIncome.Gifts, otherIncome.SocialSupport, otherIncome.Scholarship, otherIncome.Rental,
            otherIncome.Investment, otherIncome.Other, totals, total = totals.Total };
    }

    private static object Detail(TnbqSurvey item) => new
    {
        item.Id, item.Year, item.Commune, item.CommuneCode, item.Hamlet, item.HamletCode,
        item.HouseholdNumber, item.HeadName, item.Address, item.Phone, item.Members,
        item.Revision, item.IsInvalid, item.CreatedAt, item.UpdatedAt, item.UpdatedBy, salary = SalaryDetail(item), crops = CropsDetail(item), livestock = LivestockDetail(item), forestry = ForestryDetail(item), aquaculture = AquacultureDetail(item), business = BusinessDetail(item), otherIncome = OtherIncomeDetail(item)
    };
}

public class SetTnbqSurveyInvalidRequest
{
    public bool IsInvalid { get; set; }
    [Range(1, int.MaxValue)] public int Revision { get; set; }
}

public class SaveTnbqSurveyRequest
{
    [Range(2000, 2100)] public int Year { get; set; }
    [Required, StringLength(150)] public string Commune { get; set; } = "";
    [RegularExpression(@"^$|^[0-9]{5}$", ErrorMessage = "Mã xã/phường gồm 5 chữ số.")]
    public string? CommuneCode { get; set; }
    [Required, StringLength(150)] public string Hamlet { get; set; } = "";
    [RegularExpression(@"^$|^[0-9]{3}$", ErrorMessage = "Mã địa bàn gồm 3 chữ số.")]
    public string? HamletCode { get; set; }
    [Required, StringLength(50)] public string HouseholdNumber { get; set; } = "";
    [Required, StringLength(150)] public string HeadName { get; set; } = "";
    [StringLength(500)] public string? Address { get; set; }
    [StringLength(30)] public string? Phone { get; set; }
    [Range(1, 200)] public int Members { get; set; }
    public int Revision { get; set; }
    public SalaryRequest? Salary { get; set; }
    public CropsRequest? Crops { get; set; }
    public LivestockRequest? Livestock { get; set; }
    public ForestryRequest? Forestry { get; set; }
    public AquacultureRequest? Aquaculture { get; set; }
    public BusinessRequest? Business { get; set; }
    public OtherIncomeRequest? OtherIncome { get; set; }
}


public class SalaryRequest
{
    public bool? HasIncome { get; set; }
    [Required, MaxLength(200)] public List<SalaryMember> Rows { get; set; } = [];
}
public class SalaryMember
{
    [Required, StringLength(20)] public string Code { get; set; } = "";
    [Required, StringLength(150)] public string Name { get; set; } = "";
    public decimal Wage { get; set; }
    public decimal Pension { get; set; }
}
