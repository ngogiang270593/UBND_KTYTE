using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    public class CustomerImportRequest
    {
        public int? ExcelLine { get; set; }

        public string? Code { get; set; }
        public string? Name { get; set; }
        public string? ObjectType { get; set; }
        public string? PhoneNumber { get; set; }

        // Dự án hiện tại đang dùng TaxCode để lưu Năm sinh.
        public string? TaxCode { get; set; }

        public DateTime? BirthDate { get; set; }

        public DateTime? ExaminationDate { get; set; }
        public string? Address { get; set; }
        public string? Occupation { get; set; }
        public string? SourceFileName { get; set; }
    }

    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ImportDataController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ImportDataController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/ImportData/customer-rows
        [HttpGet("customer-rows")]
        public async Task<IActionResult> GetCustomerRows(
            string? code,
            string? name,
            DateTime? fromDate,
            DateTime? toDate,
            string? address,
            string? objectType,
            string? occupation)
        {
            var data = await BuildCustomerSearchQuery(code, name, fromDate, toDate, address, objectType, occupation)
                .AsNoTracking()
                .OrderByDescending(x => x.ExaminationDate)
                .ThenBy(x => x.Name)
                .Select(x => new
                {
                    x.Id,
                    x.Code,
                    x.Name,
                    x.ObjectType,
                    x.PhoneNumber,
                    x.TaxCode,
                    x.BirthDate,
                    x.ExaminationDate,
                    x.Address,
                    x.Occupation
                })
                .ToListAsync();

            return Ok(data);
        }

        // POST: api/ImportData/customer-rows
        [HttpPost("customer-rows")]
        public async Task<IActionResult> SaveCustomerRows(
            [FromBody] List<CustomerImportRequest>? rows)
        {
            if (rows == null || rows.Count == 0)
            {
                return BadRequest(new
                {
                    message = "Không có dữ liệu khám sức khỏe để import."
                });
            }

            var existingCodes = (await _context.Customers
                .AsNoTracking()
                .Where(x => x.Code != null)
                .Select(x => x.Code)
                .ToListAsync())
                .Select(NormalizeCitizenCode)
                .Where(x => x.Length > 0);

            var existingCodeSet = existingCodes.ToHashSet(
                StringComparer.OrdinalIgnoreCase
            );

            var importCodeSet = new HashSet<string>(
                StringComparer.OrdinalIgnoreCase
            );

            var existingNameBirthDateKeys = (await _context.Customers
                .AsNoTracking()
                .Where(x => x.BirthDate.HasValue)
                .Select(x => new { x.Name, x.BirthDate })
                .ToListAsync())
                .Select(x => BuildNameBirthDateKey(x.Name, x.BirthDate!.Value))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var importNameBirthDateKeys = new HashSet<string>(
                StringComparer.OrdinalIgnoreCase
            );

            var existingNameBirthYearKeys = (await _context.Customers
                .AsNoTracking()
                .Select(x => new { x.Name, x.TaxCode })
                .ToListAsync())
                .Select(x => BuildNameBirthYearKey(x.Name, x.TaxCode))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);

            var importNameBirthYearKeys = new HashSet<string>(
                StringComparer.OrdinalIgnoreCase
            );

            var validCustomers = new List<Customer>();
            var savedLines = new List<int>();
            var errors = new List<string>();

            for (var i = 0; i < rows.Count; i++)
            {
                var row = rows[i];

                // Frontend gửi đúng số dòng thật trong Excel.
                // Nếu không có thì mới dùng giá trị dự phòng.
                var excelLine = row.ExcelLine ?? (i + 6);

                var code = NormalizeCitizenCode(row.Code);
                var name = (row.Name ?? string.Empty).Trim();
                var objectType = (row.ObjectType ?? string.Empty).Trim();
                var phoneNumber = (row.PhoneNumber ?? string.Empty).Trim();
                var birthYear = (row.TaxCode ?? string.Empty).Trim();
                var birthDate = row.BirthDate?.Date;
                var address = (row.Address ?? string.Empty).Trim();
                var occupation = (row.Occupation ?? string.Empty).Trim();

                var rowErrors = new List<string>();

                if (string.IsNullOrWhiteSpace(name))
                {
                    rowErrors.Add("thiếu Họ và tên");
                }

                if (string.IsNullOrWhiteSpace(birthYear))
                {
                    rowErrors.Add("thiếu Năm sinh");
                }
                else if (!int.TryParse(birthYear, out var year))
                {
                    rowErrors.Add("Năm sinh không hợp lệ");
                }
                else if (year < 1900 || year > DateTime.Today.Year)
                {
                    rowErrors.Add(
                        $"Năm sinh phải từ 1900 đến {DateTime.Today.Year}"
                    );
                }

                if (!row.ExaminationDate.HasValue)
                {
                    rowErrors.Add("thiếu Ngày khám");
                }
                else if (row.ExaminationDate.Value.Date > DateTime.Today)
                {
                    rowErrors.Add("Ngày khám không được lớn hơn ngày hiện tại");
                }

                if (birthDate.HasValue && birthDate.Value > DateTime.Today)
                {
                    rowErrors.Add("Ngày sinh không được lớn hơn ngày hiện tại");
                }

                if (!string.IsNullOrWhiteSpace(code))
                {
                    if (existingCodeSet.Contains(code))
                    {
                        rowErrors.Add("Căn cước đã tồn tại trong hệ thống");
                    }
                    else if (!importCodeSet.Add(code))
                    {
                        rowErrors.Add("Căn cước bị trùng trong file import");
                    }
                }
                else if (!string.IsNullOrWhiteSpace(name))
                {
                    var nameBirthYearKey = BuildNameBirthYearKey(name, birthYear);

                    if (birthDate.HasValue)
                    {
                        var nameBirthDateKey = BuildNameBirthDateKey(name, birthDate.Value);

                        if (existingNameBirthDateKeys.Contains(nameBirthDateKey))
                        {
                            rowErrors.Add("Họ và tên, Ngày sinh đã tồn tại trong hệ thống");
                        }
                        else if (!importNameBirthDateKeys.Add(nameBirthDateKey))
                        {
                            rowErrors.Add("Họ và tên, Ngày sinh bị trùng trong file import");
                        }
                        else if (importNameBirthYearKeys.Contains(nameBirthYearKey))
                        {
                            rowErrors.Add("Họ và tên, Năm sinh bị trùng trong file import");
                        }

                        importNameBirthYearKeys.Add(nameBirthYearKey);
                    }
                    else if (existingNameBirthYearKeys.Contains(nameBirthYearKey))
                    {
                        rowErrors.Add("Họ và tên, Năm sinh đã tồn tại trong hệ thống");
                    }
                    else if (!importNameBirthYearKeys.Add(nameBirthYearKey))
                    {
                        rowErrors.Add("Họ và tên, Năm sinh bị trùng trong file import");
                    }
                }

                if (rowErrors.Count > 0)
                {
                    errors.Add(
                        $"Dòng {excelLine}: {string.Join("; ", rowErrors)}."
                    );
                    continue;
                }

                validCustomers.Add(new Customer
                {
                    Code = code,
                    Name = name,
                    ObjectType = objectType,
                    PhoneNumber = phoneNumber,
                    TaxCode = birthYear,
                    BirthDate = birthDate,
                    ExaminationDate = row.ExaminationDate!.Value.Date,
                    Address = address,
                    Occupation = occupation
                });

                savedLines.Add(excelLine);
            }

            if (validCustomers.Count > 0)
            {
                await _context.Customers.AddRangeAsync(validCustomers);

                try
                {
                    await _context.SaveChangesAsync();
                }
                catch (DbUpdateException)
                {
                    return Conflict(new
                    {
                        message =
                            "Không thể lưu vì có Căn cước bị trùng trong cơ sở dữ liệu. Vui lòng tải lại danh sách và thử lại."
                    });
                }
            }

            return Ok(new
            {
                message = validCustomers.Count > 0
                    ? "Import danh sách khám sức khỏe hoàn tất."
                    : "Không có dòng hợp lệ để lưu.",

                totalCount = rows.Count,
                savedCount = validCustomers.Count,
                savedLines,
                errorCount = errors.Count,
                errors
            });
        }

        // DELETE: api/ImportData/customer-rows/15
        [HttpDelete("customer-rows/{id:int}")]
        public async Task<IActionResult> DeleteCustomerRow(int id)
        {
            var customer = await _context.Customers.FindAsync(id);

            if (customer == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy dữ liệu cần xóa."
                });
            }

            var deletedName = customer.Name;
            var deletedCode = customer.Code;

            _context.Customers.Remove(customer);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã xóa dữ liệu khám sức khỏe.",
                id,
                name = deletedName,
                code = deletedCode
            });
        }

        // DELETE: api/ImportData/customer-rows
        [HttpDelete("customer-rows")]
        public async Task<IActionResult> ClearCustomerRows(
            string? code,
            string? name,
            DateTime? fromDate,
            DateTime? toDate,
            string? address,
            string? objectType,
            string? occupation)
        {
            var deletedCount = await BuildCustomerSearchQuery(code, name, fromDate, toDate, address, objectType, occupation)
                .ExecuteDeleteAsync();

            if (deletedCount == 0)
            {
                return Ok(new
                {
                    message = "Danh sách hiện đang trống.",
                    count = 0
                });
            }

            return Ok(new
            {
                message = "Đã xóa dữ liệu khám sức khỏe theo điều kiện tìm kiếm.",
                count = deletedCount
            });
        }

        // Dùng chung điều kiện với màn hình In ấn để xóa đúng danh sách đang tìm kiếm.
        private IQueryable<Customer> BuildCustomerSearchQuery(
            string? code,
            string? name,
            DateTime? fromDate,
            DateTime? toDate,
            string? address,
            string? objectType,
            string? occupation)
        {
            var query = _context.Customers.AsQueryable();

            if (!string.IsNullOrWhiteSpace(code))
            {
                var keyword = code.Trim();
                query = query.Where(x => x.Code != null && x.Code.Contains(keyword));
            }

            if (!string.IsNullOrWhiteSpace(name))
            {
                var keyword = name.Trim().ToLower();
                query = query.Where(x =>
                    x.Name != null && AppDbContext.UnicodeLower(x.Name).Contains(keyword));
            }

            if (fromDate.HasValue)
            {
                query = query.Where(x => x.ExaminationDate.Date >= fromDate.Value.Date);
            }

            if (toDate.HasValue)
            {
                query = query.Where(x => x.ExaminationDate.Date <= toDate.Value.Date);
            }

            if (!string.IsNullOrWhiteSpace(address))
            {
                var keyword = address.Trim().ToLower();
                query = query.Where(x =>
                    x.Address != null && AppDbContext.UnicodeLower(x.Address).Contains(keyword));
            }

            if (!string.IsNullOrWhiteSpace(objectType))
            {
                var keyword = objectType.Trim().ToLower();
                query = query.Where(x =>
                    x.ObjectType != null && AppDbContext.UnicodeLower(x.ObjectType).Contains(keyword));
            }

            if (!string.IsNullOrWhiteSpace(occupation))
            {
                var keyword = occupation.Trim().ToLower();
                query = query.Where(x =>
                    x.Occupation != null && AppDbContext.UnicodeLower(x.Occupation).Contains(keyword));
            }

            return query;
        }

        private static string NormalizeCitizenCode(string? value)
        {
            var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
            return digits.Length == 11 ? $"0{digits}" : digits;
        }

        private static string BuildNameBirthDateKey(string? name, DateTime birthDate)
        {
            return $"{NormalizeName(name)}\u001F{birthDate.Date:yyyyMMdd}";
        }

        private static string BuildNameBirthYearKey(string? name, string? birthYear)
        {
            return $"{NormalizeName(name)}\u001F{(birthYear ?? string.Empty).Trim()}";
        }

        private static string NormalizeName(string? name)
        {
            return string.Join(
                ' ',
                (name ?? string.Empty).Split(
                    (char[]?)null,
                    StringSplitOptions.RemoveEmptyEntries
                )
            ).ToUpperInvariant();
        }

    }
}
