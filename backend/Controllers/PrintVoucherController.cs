using System.IO.Compression;
using ClosedXML.Excel;
using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;

namespace backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class PrintVoucherController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PrintVoucherController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/PrintVoucher/customers
        // Tìm trực tiếp trong bảng Customers.
        [HttpGet("customers")]
        public async Task<IActionResult> GetCustomers(
            string? code,
            string? name,
            DateTime? fromDate,
            DateTime? toDate,
            string? address,
            string? objectType,
            string? occupation
        )
        {
            var query = BuildCustomerSearchQuery(
                code,
                name,
                fromDate,
                toDate,
                address,
                objectType,
                occupation
            );

            var customers = await query
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

            return Ok(customers);
        }

        public sealed class UpdateAddressesRequest { public List<int> CustomerIds { get; set; } = new(); public bool PreviewOnly { get; set; } public bool UpdateBirthDateOnly { get; set; } public string UpdateMode { get; set; } = "address"; public string Source { get; set; } = "all"; public string MatchType { get; set; } = "all"; }
        public sealed class UpdateObjectTypeRequest { public int CustomerId { get; set; } public int CommuneSubjectId { get; set; } }
        public sealed class UpdateObjectTypesRequest { public List<int> CustomerIds { get; set; } = new(); }
        private sealed record AddressLookupRow(string Cccd, string FullName, string BirthDate, string BirthYear, string Address, string Source, string SourceLabel);

        [HttpPost("customers/update-addresses-from-commune-subjects")]
        public async Task<IActionResult> UpdateAddressesFromCommuneSubjects([FromBody] UpdateAddressesRequest request)
        {
            var ids = request.CustomerIds.Distinct().ToList();
            if (ids.Count == 0) return BadRequest(new { message = "Không có hồ sơ cần cập nhật địa chỉ." });
            var customers = await _context.Customers.Where(x => ids.Contains(x.Id)).ToListAsync();
            var source = request.Source?.Trim().ToLowerInvariant() ?? "commune";
            var matchType = request.MatchType?.Trim().ToLowerInvariant() ?? "all";
            var updateMode = request.UpdateMode?.Trim().ToLowerInvariant() ?? "address";
            var updateBirthDateOnly = request.UpdateBirthDateOnly || updateMode == "birth-date";
            if (!new[] { "all", "cccd", "name-date", "name-year" }.Contains(matchType)) matchType = "all";
            var validSources = new[] { "all", "commune", "inpatient", "outpatient", "medical" };
            if (!validSources.Contains(source)) source = "all";
            var subjects = new List<AddressLookupRow>();
            if (source is "all" or "commune") subjects.AddRange(await _context.CommuneSubjectRecords.AsNoTracking().Where(x => x.DiaChi != "").Select(x => new AddressLookupRow(x.Cccd, x.HoTen, x.NgaySinh, "", x.DiaChi, "commune", "Đối tượng xã")).ToListAsync());
            if (source is "all" or "inpatient") subjects.AddRange(await _context.TanChauInpatientRecords.AsNoTracking().Where(x => x.DiaChi != "").Select(x => new AddressLookupRow(x.SoCccd, x.HoTen, x.NgaySinh, "", x.DiaChi, "inpatient", "Nội trú Tân Châu")).ToListAsync());
            if (source is "all" or "outpatient") subjects.AddRange(await _context.TanChauOutpatientRecords.AsNoTracking().Where(x => x.DiaChi != "").Select(x => new AddressLookupRow(x.Cccd, x.HoTen, "", x.NamSinh, x.DiaChi, "outpatient", "Ngoại trú Tân Châu")).ToListAsync());
            if (source is "all" or "medical")
            {
                var medicalRows = await _context.MedicalRecords.AsNoTracking().Where(x => x.Address != "").Select(x => new { x.CitizenId, x.FullName, x.DateOfBirth, x.Address }).ToListAsync();
                subjects.AddRange(medicalRows.Select(x => new AddressLookupRow(x.CitizenId, x.FullName, x.DateOfBirth?.ToString("yyyy-MM-dd") ?? "", x.DateOfBirth?.Year.ToString() ?? "", x.Address, "medical", "Y bạ")));
            }
            var sourceLabel = source == "all" ? "4 danh sách" : subjects.FirstOrDefault()?.SourceLabel ?? source;
            var byCccd = subjects.Where(x => !string.IsNullOrWhiteSpace(x.Cccd)).GroupBy(x => NormalizeIdentity(x.Cccd)).ToDictionary(x => x.Key, x => x.First());
            var byNameBirthDate = subjects.Where(x => !string.IsNullOrWhiteSpace(x.FullName) && !string.IsNullOrWhiteSpace(x.BirthDate)).GroupBy(x => $"{NormalizeText(x.FullName)}|{NormalizeDate(x.BirthDate)}").ToDictionary(x => x.Key, x => x.First());
            var byNameBirthYear = subjects.Where(x => !string.IsNullOrWhiteSpace(x.FullName) && (!string.IsNullOrWhiteSpace(x.BirthYear) || !string.IsNullOrWhiteSpace(x.BirthDate))).GroupBy(x => $"{NormalizeText(x.FullName)}|{NormalizeYear(!string.IsNullOrWhiteSpace(x.BirthYear) ? x.BirthYear : x.BirthDate)}").ToDictionary(x => x.Key, x => x.First());
            var updated = 0;
            var matchable = 0;
            var details = new List<object>();
            foreach (var customer in customers)
            {
                string? address = null;
                AddressLookupRow? matchedRow = null;
                var method = "Không khớp";
                if ((matchType is "all" or "cccd") && !string.IsNullOrWhiteSpace(customer.Code) && byCccd.TryGetValue(NormalizeIdentity(customer.Code), out var cccdMatch)) { matchedRow = cccdMatch; address = cccdMatch.Address; method = "CCCD"; }
                if ((matchType is "all" or "name-date") && address == null && customer.BirthDate.HasValue && byNameBirthDate.TryGetValue($"{NormalizeText(customer.Name)}|{customer.BirthDate.Value:yyyyMMdd}", out var dateMatch)) { matchedRow = dateMatch; address = dateMatch.Address; method = "Họ tên + Ngày sinh"; }
                var customerYear = customer.BirthDate?.Year.ToString() ?? customer.TaxCode;
                if ((matchType is "all" or "name-year") && address == null && !string.IsNullOrWhiteSpace(customerYear) && byNameBirthYear.TryGetValue($"{NormalizeText(customer.Name)}|{NormalizeYear(customerYear)}", out var yearMatch)) { matchedRow = yearMatch; address = yearMatch.Address; method = "Họ tên + Năm sinh"; }
                var matched = !string.IsNullOrWhiteSpace(address);
                if (matched) matchable++;
                var matchedSource = matchedRow?.Source ?? source;
                var matchedSourceLabel = matchedRow?.SourceLabel ?? sourceLabel;
                var newBirthDate = ParseFullDate(matchedRow?.BirthDate);
                var addressChanged = matched && !string.Equals(customer.Address?.Trim(), address!.Trim(), StringComparison.OrdinalIgnoreCase);
                var birthDateChanged = newBirthDate.HasValue && customer.BirthDate?.Date != newBirthDate.Value.Date;
                var changes = new List<string>();
                if (addressChanged) changes.Add($"Địa chỉ: '{customer.Address ?? ""}' → '{address?.Trim()}'");
                if (birthDateChanged) changes.Add($"Ngày sinh: '{customer.BirthDate?.ToString("dd/MM/yyyy") ?? "chưa có"}' → '{newBirthDate:dd/MM/yyyy}'");
                details.Add(new { customerId = customer.Id, customer.Name, source = matchedSource, sourceLabel = matchedSourceLabel, method, matched, currentAddress = customer.Address ?? "", newAddress = address?.Trim() ?? "", currentBirthDate = customer.BirthDate?.ToString("dd/MM/yyyy") ?? "", newBirthDate = newBirthDate?.ToString("dd/MM/yyyy") ?? "", addressChanged, birthDateChanged, description = matched ? $"Nguồn {matchedSourceLabel}; khớp theo {method}. {(changes.Count > 0 ? string.Join("; ", changes) : "Thông tin hiện tại đã trùng với nguồn đối chiếu.")}" : $"Đã kiểm tra {sourceLabel}; không tìm thấy bản ghi khớp theo CCCD, Họ tên + Ngày sinh hoặc Họ tên + Năm sinh." });
                var shouldUpdateAddress = !updateBirthDateOnly;
                var hasChanges = (shouldUpdateAddress && addressChanged) || birthDateChanged;
                if (!request.PreviewOnly && matched && hasChanges)
                {
                    if (shouldUpdateAddress && addressChanged) customer.Address = address!.Trim();
                    if (birthDateChanged) customer.BirthDate = newBirthDate;
                    updated++;
                }
            }
            if (!request.PreviewOnly) await _context.SaveChangesAsync();
            var updateLabel = updateBirthDateOnly ? "ngày sinh" : "địa chỉ và ngày sinh";
            return Ok(new { message = request.PreviewOnly ? "Đã kiểm tra dữ liệu có thể cập nhật." : $"Đã cập nhật {updateLabel} cho {updated}/{customers.Count} hồ sơ.", updated, checkedCount = customers.Count, matchable, notMatched = customers.Count - matchable, details });
        }

        [HttpGet("customers/object-type-mismatches")]
        public async Task<IActionResult> GetObjectTypeMismatches()
        {
            var customers = await _context.Customers.AsNoTracking()
                .Where(x => x.BirthDate.HasValue && x.Name != "")
                .Select(x => new { x.Id, x.Code, x.Name, x.BirthDate, x.Address, x.ObjectType })
                .ToListAsync();
            var subjects = await _context.CommuneSubjectRecords.AsNoTracking()
                .Where(x => x.HoTen != "" && x.NgaySinh != "" && x.DoiTuong != "")
                .Select(x => new { x.Id, x.HoTen, x.NgaySinh, x.DiaChi, x.DoiTuong })
                .ToListAsync();

            var subjectByNameAndDate = subjects
                .GroupBy(x => $"{NormalizeText(x.HoTen)}|{NormalizeDate(x.NgaySinh)}")
                .ToDictionary(x => x.Key, x => x.First());

            var result = customers.Select(customer =>
            {
                subjectByNameAndDate.TryGetValue($"{NormalizeText(customer.Name)}|{customer.BirthDate:yyyyMMdd}", out var subject);
                return new { customer, subject };
            })
            .Where(x => x.subject != null && NormalizeText(x.customer.ObjectType) != NormalizeText(x.subject.DoiTuong))
            .OrderBy(x => x.customer.Name)
            .Select(x => new
            {
                customerId = x.customer.Id,
                x.customer.Code,
                customerName = x.customer.Name,
                customerBirthDate = x.customer.BirthDate,
                customerAddress = x.customer.Address,
                currentObjectType = x.customer.ObjectType,
                communeSubjectId = x.subject!.Id,
                subjectName = x.subject.HoTen,
                subjectBirthDate = x.subject.NgaySinh,
                subjectAddress = x.subject.DiaChi,
                newObjectType = x.subject.DoiTuong
            });

            return Ok(result);
        }

        [HttpPost("customers/update-object-type")]
        public async Task<IActionResult> UpdateObjectType([FromBody] UpdateObjectTypeRequest request)
        {
            var customer = await _context.Customers.FindAsync(request.CustomerId);
            var subject = await _context.CommuneSubjectRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.CommuneSubjectId);
            if (customer == null || subject == null) return NotFound(new { message = "Không tìm thấy dữ liệu cần cập nhật." });
            if (!customer.BirthDate.HasValue || NormalizeText(customer.Name) != NormalizeText(subject.HoTen) || customer.BirthDate.Value.ToString("yyyyMMdd") != NormalizeDate(subject.NgaySinh))
                return BadRequest(new { message = "Họ tên và ngày sinh không còn khớp với danh sách đối tượng xã." });
            if (string.IsNullOrWhiteSpace(subject.DoiTuong)) return BadRequest(new { message = "Danh sách đối tượng xã chưa có thông tin đối tượng." });

            customer.ObjectType = subject.DoiTuong.Trim();
            await _context.SaveChangesAsync();
            return Ok(new { message = $"Đã cập nhật đối tượng cho {customer.Name}.", objectType = customer.ObjectType });
        }

        [HttpPost("customers/update-object-types")]
        public async Task<IActionResult> UpdateObjectTypes([FromBody] UpdateObjectTypesRequest request)
        {
            var ids = request.CustomerIds.Distinct().ToList();
            if (ids.Count == 0) return BadRequest(new { message = "Không có hồ sơ cần cập nhật đối tượng." });

            var customers = await _context.Customers
                .Where(x => ids.Contains(x.Id) && x.BirthDate.HasValue && x.Name != "")
                .ToListAsync();
            var subjects = await _context.CommuneSubjectRecords.AsNoTracking()
                .Where(x => x.HoTen != "" && x.NgaySinh != "" && x.DoiTuong != "")
                .Select(x => new { x.HoTen, x.NgaySinh, x.DoiTuong })
                .ToListAsync();
            var subjectByNameAndDate = subjects
                .GroupBy(x => $"{NormalizeText(x.HoTen)}|{NormalizeDate(x.NgaySinh)}")
                .ToDictionary(x => x.Key, x => x.First());
            var updated = 0;

            foreach (var customer in customers)
            {
                if (!subjectByNameAndDate.TryGetValue($"{NormalizeText(customer.Name)}|{customer.BirthDate:yyyyMMdd}", out var subject)) continue;
                if (NormalizeText(customer.ObjectType) == NormalizeText(subject.DoiTuong)) continue;
                customer.ObjectType = subject.DoiTuong.Trim();
                updated++;
            }

            if (updated > 0) await _context.SaveChangesAsync();
            return Ok(new { message = $"Đã cập nhật đối tượng cho {updated}/{ids.Count} hồ sơ.", updated, checkedCount = ids.Count });
        }

        private static string NormalizeIdentity(string? value) => new string((value ?? "").Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        private static string NormalizeText(string? value)
        {
            var normalized = (value ?? "").Trim().Normalize(NormalizationForm.FormD);
            return new string(normalized.Where(x => CharUnicodeInfo.GetUnicodeCategory(x) != UnicodeCategory.NonSpacingMark).ToArray()).Replace('đ', 'd').Replace('Đ', 'D').ToUpperInvariant();
        }
        private static string NormalizeDate(string? value)
        {
            var text = (value ?? "").Trim();
            var formats = new[] { "d/M/yyyy", "dd/MM/yyyy", "d-M-yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "M/d/yyyy" };
            return DateTime.TryParseExact(text, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) || DateTime.TryParse(text, CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out date) ? date.ToString("yyyyMMdd") : text.Replace("/", "").Replace("-", "");
        }
        private static string NormalizeYear(string? value)
        {
            var text = (value ?? "").Trim();
            if (DateTime.TryParse(text, CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out var date)) return date.Year.ToString();
            var digits = new string(text.Where(char.IsDigit).ToArray());
            return digits.Length >= 4 ? digits.Substring(digits.Length - 4) : digits;
        }
        private static DateTime? ParseFullDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var formats = new[] { "d/M/yyyy", "dd/MM/yyyy", "d-M-yyyy", "dd-MM-yyyy", "yyyy-MM-dd", "M/d/yyyy" };
            return DateTime.TryParseExact(value.Trim(), formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) || DateTime.TryParse(value.Trim(), CultureInfo.GetCultureInfo("vi-VN"), DateTimeStyles.None, out date) ? date.Date : null;
        }

        // GET: api/PrintVoucher/customers/export
        // Xuất đúng danh sách Customers đang được tìm kiếm trên màn hình.
        public sealed class ExportCustomersRequest
        {
            public List<int> CustomerIds { get; set; } = new();
        }

        [HttpPost("customers/export")]
        public async Task<IActionResult> ExportCustomers([FromBody] ExportCustomersRequest request)
        {
            var customerIds = request.CustomerIds.Distinct().ToList();
            if (customerIds.Count == 0)
            {
                return BadRequest("Không có khám sức khỏe để xuất Excel.");
            }

            var customers = await _context.Customers
                .AsNoTracking()
                .Where(x => customerIds.Contains(x.Id))
                .OrderByDescending(x => x.ExaminationDate)
                .ThenBy(x => x.Name)
                .Select(x => new
                {
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

            if (customers.Count == 0)
            {
                return BadRequest("Không có khám sức khỏe để xuất Excel.");
            }

            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("khám sức khỏe");

            worksheet.Range("A1:J1").Merge();
            worksheet.Cell("A1").Value = "DANH SÁCH KHÁM SỨC KHỎE";
            worksheet.Cell("A1").Style.Font.Bold = true;
            worksheet.Cell("A1").Style.Font.FontSize = 16;
            worksheet.Cell("A1").Style.Font.FontColor = XLColor.White;
            worksheet.Cell("A1").Style.Fill.BackgroundColor =
                XLColor.FromHtml("#1D4ED8");
            worksheet.Cell("A1").Style.Alignment.Horizontal =
                XLAlignmentHorizontalValues.Center;
            worksheet.Cell("A1").Style.Alignment.Vertical =
                XLAlignmentVerticalValues.Center;
            worksheet.Row(1).Height = 28;

            worksheet.Range("A2:J2").Merge();
            worksheet.Cell("A2").Value =
                $"Ngày xuất: {DateTime.Now:dd/MM/yyyy HH:mm}";
            worksheet.Cell("A2").Style.Font.Italic = true;
            worksheet.Cell("A2").Style.Alignment.Horizontal =
                XLAlignmentHorizontalValues.Center;

            var headers = new[]
            {
                "STT",
                "Căn cước",
                "Họ và tên",
                "Đối tượng",
                "Số điện thoại",
                "Năm sinh",
                "Ngày khám",
                "Địa chỉ",
                "Nghề nghiệp"
            };

            headers = headers.Append("Ngày sinh").ToArray();

            for (var col = 0; col < headers.Length; col++)
            {
                var cell = worksheet.Cell(4, col + 1);
                cell.Value = headers[col];
                cell.Style.Font.Bold = true;
                cell.Style.Font.FontColor = XLColor.White;
                cell.Style.Fill.BackgroundColor =
                    XLColor.FromHtml("#2563EB");
                cell.Style.Alignment.Horizontal =
                    XLAlignmentHorizontalValues.Center;
                cell.Style.Alignment.Vertical =
                    XLAlignmentVerticalValues.Center;
                cell.Style.Border.OutsideBorder =
                    XLBorderStyleValues.Thin;
            }

            var rowIndex = 5;
            var stt = 1;

            foreach (var customer in customers)
            {
                worksheet.Cell(rowIndex, 1).Value = stt;
                worksheet.Cell(rowIndex, 2).Value = customer.Code;
                worksheet.Cell(rowIndex, 3).Value = customer.Name;
                worksheet.Cell(rowIndex, 4).Value = customer.ObjectType;
                worksheet.Cell(rowIndex, 5).Value = customer.PhoneNumber;
                worksheet.Cell(rowIndex, 6).Value = customer.TaxCode;
                worksheet.Cell(rowIndex, 7).Value =
                    customer.ExaminationDate;
                worksheet.Cell(rowIndex, 8).Value = customer.Address;
                worksheet.Cell(rowIndex, 9).Value = customer.Occupation;
                worksheet.Cell(rowIndex, 10).Value = customer.BirthDate;

                worksheet.Cell(rowIndex, 2).Style.NumberFormat.Format = "@";
                worksheet.Cell(rowIndex, 4).Style.NumberFormat.Format = "@";
                worksheet.Cell(rowIndex, 7).Style.DateFormat.Format =
                    "dd/MM/yyyy";
                worksheet.Cell(rowIndex, 10).Style.DateFormat.Format =
                    "dd/MM/yyyy";

                worksheet.Range(rowIndex, 1, rowIndex, 10)
                    .Style.Border.OutsideBorder = XLBorderStyleValues.Thin;

                worksheet.Range(rowIndex, 1, rowIndex, 10)
                    .Style.Border.InsideBorder = XLBorderStyleValues.Thin;

                if (stt % 2 == 0)
                {
                    worksheet.Range(rowIndex, 1, rowIndex, 10)
                        .Style.Fill.BackgroundColor =
                        XLColor.FromHtml("#EFF6FF");
                }

                rowIndex++;
                stt++;
            }

            worksheet.Column(1).Width = 8;
            worksheet.Column(2).Width = 20;
            worksheet.Column(3).Width = 28;
            worksheet.Column(4).Width = 16;
            worksheet.Column(5).Width = 16;
            worksheet.Column(6).Width = 12;
            worksheet.Column(7).Width = 15;
            worksheet.Column(8).Width = 42;
            worksheet.Column(9).Width = 30;
            worksheet.Column(10).Width = 15;

            worksheet.Column(8).Style.Alignment.WrapText = true;
            worksheet.SheetView.FreezeRows(4);

            worksheet.Range(4, 1, rowIndex - 1, 10)
                .SetAutoFilter();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            var fileName =
                $"DanhSachKhamSucKhoe_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";

            Response.Headers.Append(
                "Access-Control-Expose-Headers",
                "Content-Disposition"
            );

            return File(
                stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                fileName
            );
        }

        private IQueryable<backend.Models.Customer> BuildCustomerSearchQuery(
            string? code,
            string? name,
            DateTime? fromDate,
            DateTime? toDate,
            string? address,
            string? objectType,
            string? occupation
        )
        {
            var query = _context.Customers
                .AsNoTracking()
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(code))
            {
                var keyword = code.Trim();

                query = query.Where(x =>
                    x.Code != null &&
                    x.Code.Contains(keyword)
                );
            }

            if (!string.IsNullOrWhiteSpace(name))
            {
                var keyword = name.Trim().ToLower();

                query = query.Where(x =>
                    x.Name != null &&
                    AppDbContext.UnicodeLower(x.Name).Contains(keyword)
                );
            }

            if (fromDate.HasValue)
            {
                query = query.Where(x =>
                    x.ExaminationDate >= fromDate.Value.Date
                );
            }

            if (toDate.HasValue)
            {
                var exclusiveToDate = toDate.Value.Date.AddDays(1);
                query = query.Where(x =>
                    x.ExaminationDate < exclusiveToDate
                );
            }

            if (!string.IsNullOrWhiteSpace(address))
            {
                var keyword = address.Trim().ToLower();

                query = query.Where(x =>
                    x.Address != null &&
                    AppDbContext.UnicodeLower(x.Address).Contains(keyword)
                );
            }

            if (!string.IsNullOrWhiteSpace(objectType))
            {
                var keyword = objectType.Trim().ToLower();

                query = query.Where(x =>
                    x.ObjectType != null &&
                    AppDbContext.UnicodeLower(x.ObjectType).Contains(keyword)
                );
            }

            if (!string.IsNullOrWhiteSpace(occupation))
            {
                var keyword = occupation.Trim().ToLower();

                query = query.Where(x =>
                    x.Occupation != null &&
                    AppDbContext.UnicodeLower(x.Occupation).Contains(keyword)
                );
            }

            return query;
        }

        private static string NumberToVietnameseText(decimal amount)
        {
            long number = (long)Math.Round(amount);

            if (number == 0)
                return "Không đồng";

            string[] ones =
            {
                "", "một", "hai", "ba", "bốn",
                "năm", "sáu", "bảy", "tám", "chín"
            };

            string Read3Digits(int n)
            {
                int tram = n / 100;
                int chuc = (n % 100) / 10;
                int donvi = n % 10;

                string result = "";

                if (tram > 0)
                {
                    result += ones[tram] + " trăm";

                    if (chuc == 0 && donvi > 0)
                        result += " lẻ";
                }

                if (chuc > 1)
                {
                    result += " " + ones[chuc] + " mươi";

                    if (donvi == 1)
                        result += " mốt";
                    else if (donvi == 5)
                        result += " lăm";
                    else if (donvi > 0)
                        result += " " + ones[donvi];
                }
                else if (chuc == 1)
                {
                    result += " mười";

                    if (donvi == 5)
                        result += " lăm";
                    else if (donvi > 0)
                        result += " " + ones[donvi];
                }
                else if (donvi > 0)
                {
                    result += " " + ones[donvi];
                }

                return result.Trim();
            }

            string[] units = { "", " nghìn", " triệu", " tỷ" };

            var parts = new List<string>();
            int unitIndex = 0;

            while (number > 0)
            {
                int group = (int)(number % 1000);

                if (group > 0)
                {
                    string text = Read3Digits(group);

                    if (!string.IsNullOrWhiteSpace(text))
                        parts.Insert(0, text + units[unitIndex]);
                }

                number /= 1000;
                unitIndex++;
            }

            string resultText = string.Join(" ", parts).Trim();

            return char.ToUpper(resultText[0]) +
                resultText.Substring(1) +
                " đồng";
        }
        [HttpGet("export")]
        public async Task<IActionResult> Export(
            string? templateType,
            string? customerCode,
            DateTime? fromDate,
            DateTime? toDate
        )
        {
            if (string.IsNullOrWhiteSpace(templateType))
            {
                templateType = "PurchaseSheet";
            }

            if (templateType == "PaymentVoucher")
                return BadRequest("Chức năng in Phiếu chi đã được loại bỏ.");

            var template = await _context.PrintTemplates
                .FirstOrDefaultAsync(x => x.TemplateType == templateType);

            if (template == null)
                return BadRequest("Chưa upload mẫu in cho loại này");

            if (!System.IO.File.Exists(template.FilePath))
                return BadRequest("File mẫu không tồn tại");

            var ext = Path.GetExtension(template.FileName).ToLower();

            var query =
                from p in _context.ImportedPurchaseRows
                join c in _context.Customers
                    on p.CustomerCode.Trim() equals c.Code.Trim()
                    into customerJoin
                from c in customerJoin.DefaultIfEmpty()
                select new
                {
                    p.CustomerCode,
                    CustomerName = c != null ? c.Name : "",
                    Address = c != null ? c.Address : "",
                    p.PurchaseDate,
                    p.TotalAmount
                };

            if (!string.IsNullOrWhiteSpace(customerCode))
            {
                query = query.Where(x => x.CustomerCode.Trim() == customerCode.Trim());
            }

            if (fromDate.HasValue)
            {
                query = query.Where(x => x.PurchaseDate.Date >= fromDate.Value.Date);
            }

            if (toDate.HasValue)
            {
                query = query.Where(x => x.PurchaseDate.Date <= toDate.Value.Date);
            }
            var rows = await query
                .OrderBy(x => x.PurchaseDate)
                .ThenBy(x => x.CustomerName)
                .ToListAsync();

            if (!rows.Any())
                return BadRequest("Không có dữ liệu để xuất");

            if (templateType == "PurchaseSheet")
            {
                if (ext != ".xlsx")
                    return BadRequest("Mẫu Phiếu chi tờ phải là file .xlsx");

                using var zipStream = new MemoryStream();

                using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, true))
                {
                    int stt = 1;

                    foreach (var item in rows)
                    {
                        using var workbook = new XLWorkbook(template.FilePath);

                        var ws = workbook.Worksheet(1);

                        var voucherNo = $"PC {stt:00}";

                        var dateText =
                            $"Ngày {item.PurchaseDate.Day} tháng {item.PurchaseDate.Month} năm {item.PurchaseDate.Year}";

                        ws.Cell("D5").Value = dateText;
                        ws.Cell("C7").Value = item.CustomerName;
                        ws.Cell("J7").Value = voucherNo;
                        ws.Cell("B8").Value = item.Address;

                        ws.Cell("B10").Value = item.TotalAmount;
                        ws.Cell("B10").Style.NumberFormat.Format = "#,##0";

                        ws.Cell("D10").Value = NumberToVietnameseText(item.TotalAmount);
                        ws.Cell("D20").Value = NumberToVietnameseText(item.TotalAmount);
                        ws.Cell("G21").Value = dateText;

                        using var excelStream = new MemoryStream();

                        workbook.SaveAs(excelStream);

                        excelStream.Position = 0;

                        var entry = archive.CreateEntry(
                            $"PhieuChiTo_{voucherNo}.xlsx",
                            CompressionLevel.Fastest
                        );

                        using var entryStream = entry.Open();

                        excelStream.CopyTo(entryStream);

                        stt++;
                    }
                }

                zipStream.Position = 0;
                Response.Headers.Append(
                    "Access-Control-Expose-Headers",
                    "Content-Disposition"
                );
                return File(
                    zipStream.ToArray(),
                    "application/zip",
                    $"PhieuChiTo_{DateTime.Now:yyyyMMdd_HHmmss}.zip"
                );
            }

            return BadRequest("Loại mẫu chưa được hỗ trợ");
        }

    }
}
