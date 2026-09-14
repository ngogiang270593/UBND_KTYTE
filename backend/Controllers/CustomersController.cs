using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class CustomersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CustomersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var customers = await _context.Customers
                .Include(x => x.ExaminationNumber)
                .OrderByDescending(x => x.ExaminationDate)
                .ThenByDescending(x => x.ExaminationNumber == null ? 0 : x.ExaminationNumber.Number)
                .ThenBy(x => x.Name)
                .ThenBy(x => x.Id)
                .ToListAsync();

            foreach (var customer in customers)
                customer.ExaminationSequenceNumber = customer.ExaminationNumber?.Number;

            return Ok(customers);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Customer customer)
        {
            customer.Code = customer.Code?.Trim() ?? string.Empty;
            customer.ExaminationPlace = customer.ExaminationPlace?.Trim() ?? string.Empty;
            customer.Name = customer.Name?.Trim() ?? string.Empty;
            customer.TaxCode = customer.TaxCode?.Trim() ?? string.Empty;
            customer.ObjectType = customer.ObjectType?.Trim() ?? string.Empty;
            customer.PhoneNumber = customer.PhoneNumber?.Trim() ?? string.Empty;
            customer.Address = customer.Address?.Trim() ?? string.Empty;
            customer.Occupation = customer.Occupation?.Trim() ?? string.Empty;
            customer.ExaminationDate = ToUtcDate(customer.ExaminationDate);
            customer.CitizenIdIssueDate = customer.CitizenIdIssueDate.HasValue
                ? ToUtcDate(customer.CitizenIdIssueDate.Value)
                : null;
            customer.BirthDate = customer.BirthDate.HasValue
                ? ToUtcDate(customer.BirthDate.Value)
                : null;

            if (string.IsNullOrWhiteSpace(customer.Code))
            {
                ModelState.AddModelError(nameof(customer.Code), "Căn cước là bắt buộc.");
            }

            if (string.IsNullOrWhiteSpace(customer.Name))
            {
                ModelState.AddModelError(nameof(customer.Name), "Họ và tên là bắt buộc.");
            }

            if (string.IsNullOrWhiteSpace(customer.TaxCode))
            {
                ModelState.AddModelError(nameof(customer.TaxCode), "Năm sinh là bắt buộc.");
            }

            if (customer.ExaminationDate == default)
            {
                ModelState.AddModelError(
                    nameof(customer.ExaminationDate),
                    "Ngày khám là bắt buộc."
                );
            }

            if (customer.BirthDate.HasValue && customer.BirthDate.Value.Date > DateTime.Today)
            {
                ModelState.AddModelError(nameof(customer.BirthDate), "Ngày sinh không được lớn hơn ngày hiện tại.");
            }

            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }
            var exists = await _context.Customers.AnyAsync(x => x.Code == customer.Code);

            if (exists)
            {
                return BadRequest(new
                {
                    message = "Căn cước đã tồn tại."
                });
            }
            if (!await SetExaminationNumber(customer, customer.ExaminationSequenceNumber))
                return Conflict(new { message = "STT khám đã được sử dụng trong ngày này." });
            _context.Customers.Add(customer);
            if (!await SaveWithNumberConflictHandling())
                return Conflict(new { message = "STT khám đã được sử dụng trong ngày này." });

            return Ok(customer);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, Customer customer)
        {
            var data = await _context.Customers.Include(x => x.ExaminationNumber).FirstOrDefaultAsync(x => x.Id == id);

            if (data == null)
            {
                return NotFound();
            }

            customer.Code = customer.Code?.Trim() ?? string.Empty;
            customer.ExaminationPlace = customer.ExaminationPlace?.Trim() ?? string.Empty;
            customer.Name = customer.Name?.Trim() ?? string.Empty;
            customer.TaxCode = customer.TaxCode?.Trim() ?? string.Empty;
            customer.ObjectType = customer.ObjectType?.Trim() ?? string.Empty;
            customer.PhoneNumber = customer.PhoneNumber?.Trim() ?? string.Empty;
            customer.Address = customer.Address?.Trim() ?? string.Empty;
            customer.Occupation = customer.Occupation?.Trim() ?? string.Empty;
            customer.ExaminationDate = ToUtcDate(customer.ExaminationDate);
            customer.CitizenIdIssueDate = customer.CitizenIdIssueDate.HasValue
                ? ToUtcDate(customer.CitizenIdIssueDate.Value)
                : null;
            customer.BirthDate = customer.BirthDate.HasValue
                ? ToUtcDate(customer.BirthDate.Value)
                : null;

            if (string.IsNullOrWhiteSpace(customer.Code))
            {
                ModelState.AddModelError(nameof(customer.Code), "Căn cước là bắt buộc.");
            }

            if (string.IsNullOrWhiteSpace(customer.Name))
            {
                ModelState.AddModelError(nameof(customer.Name), "Họ và tên là bắt buộc.");
            }

            if (string.IsNullOrWhiteSpace(customer.TaxCode))
            {
                ModelState.AddModelError(nameof(customer.TaxCode), "Năm sinh là bắt buộc.");
            }

            if (customer.ExaminationDate == default)
            {
                ModelState.AddModelError(
                    nameof(customer.ExaminationDate),
                    "Ngày khám là bắt buộc."
                );
            }

            if (customer.BirthDate.HasValue && customer.BirthDate.Value.Date > DateTime.Today)
            {
                ModelState.AddModelError(nameof(customer.BirthDate), "Ngày sinh không được lớn hơn ngày hiện tại.");
            }

            if (!ModelState.IsValid)
            {
                return ValidationProblem(ModelState);
            }

            data.Code = customer.Code;
            data.CitizenIdIssueDate = customer.CitizenIdIssueDate;
            data.Name = customer.Name;
            data.ObjectType = customer.ObjectType;
            data.PhoneNumber = customer.PhoneNumber;
            data.Address = customer.Address;
            data.TaxCode = customer.TaxCode;
            data.Occupation = customer.Occupation;
            data.ExaminationDate = customer.ExaminationDate;
            data.ExaminationPlace = customer.ExaminationPlace;
            data.BirthDate = customer.BirthDate;

            if (!await SetExaminationNumber(data, customer.ExaminationSequenceNumber))
                return Conflict(new { message = "STT khám đã được sử dụng trong ngày này." });
            if (!await SaveWithNumberConflictHandling())
                return Conflict(new { message = "STT khám đã được sử dụng trong ngày này." });
            data.ExaminationSequenceNumber = data.ExaminationNumber?.Number;

            return Ok(data);
        }

        public class ExaminationNumberRequest
        {
            [System.ComponentModel.DataAnnotations.Range(1, int.MaxValue)]
            public int? ExaminationSequenceNumber { get; set; }
        }

        [HttpPatch("{id:int}/examination-number")]
        public async Task<IActionResult> UpdateExaminationNumber(int id, ExaminationNumberRequest request)
        {
            var customer = await _context.Customers.Include(x => x.ExaminationNumber)
                .FirstOrDefaultAsync(x => x.Id == id);
            if (customer == null) return NotFound();
            if (!await SetExaminationNumber(customer, request.ExaminationSequenceNumber)
                || !await SaveWithNumberConflictHandling())
                return Conflict(new { message = "STT khám đã được sử dụng trong ngày này." });
            return Ok(new { examinationSequenceNumber = customer.ExaminationNumber?.Number });
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var data = await _context.Customers.FindAsync(id);

            if (data == null)
            {
                return NotFound();
            }

            _context.Customers.Remove(data);
            await _context.SaveChangesAsync();

            return Ok();
        }

        private async Task<bool> SetExaminationNumber(Customer customer, int? number)
        {
            var date = DateTime.SpecifyKind(customer.ExaminationDate.Date, DateTimeKind.Utc);
            if (number.HasValue && await _context.ExaminationNumbers.AnyAsync(x =>
                x.CustomerId != customer.Id && x.ExaminationDate == date && x.Number == number.Value))
                return false;

            if (!number.HasValue)
            {
                if (customer.ExaminationNumber != null)
                    _context.ExaminationNumbers.Remove(customer.ExaminationNumber);
                customer.ExaminationNumber = null;
            }
            else
            {
                customer.ExaminationNumber ??= new ExaminationNumber();
                customer.ExaminationNumber.ExaminationDate = date;
                customer.ExaminationNumber.Number = number.Value;
            }
            return true;
        }

        private async Task<bool> SaveWithNumberConflictHandling()
        {
            try
            {
                await _context.SaveChangesAsync();
                return true;
            }
            catch (DbUpdateException ex) when (
                ex.InnerException is Npgsql.PostgresException { SqlState: "23505", ConstraintName: "IX_ExaminationNumbers_ExaminationDate_Number" }
                || ex.InnerException is Microsoft.Data.Sqlite.SqliteException { SqliteExtendedErrorCode: 2067 } sqlite
                    && sqlite.Message.Contains("ExaminationNumbers.ExaminationDate"))
            {
                return false;
            }
        }

        private static DateTime ToUtcDate(DateTime value)
        {
            var date = value.Date;
            return value.Kind == DateTimeKind.Local
                ? date.ToUniversalTime()
                : DateTime.SpecifyKind(date, DateTimeKind.Utc);
        }
    }
}
