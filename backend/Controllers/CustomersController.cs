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
                .OrderByDescending(x => x.ExaminationDate)
                .ThenBy(x => x.Name)
                .ToListAsync();

            return Ok(customers);
        }

        [HttpPost]
        public async Task<IActionResult> Create(Customer customer)
        {
            customer.Code = customer.Code?.Trim() ?? string.Empty;
            customer.Name = customer.Name?.Trim() ?? string.Empty;
            customer.TaxCode = customer.TaxCode?.Trim() ?? string.Empty;
            customer.ObjectType = customer.ObjectType?.Trim() ?? string.Empty;
            customer.PhoneNumber = customer.PhoneNumber?.Trim() ?? string.Empty;
            customer.Address = customer.Address?.Trim() ?? string.Empty;
            customer.Occupation = customer.Occupation?.Trim() ?? string.Empty;
            customer.ExaminationDate = ToUtcDate(customer.ExaminationDate);
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
            _context.Customers.Add(customer);
            await _context.SaveChangesAsync();

            return Ok(customer);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, Customer customer)
        {
            var data = await _context.Customers.FindAsync(id);

            if (data == null)
            {
                return NotFound();
            }

            customer.Code = customer.Code?.Trim() ?? string.Empty;
            customer.Name = customer.Name?.Trim() ?? string.Empty;
            customer.TaxCode = customer.TaxCode?.Trim() ?? string.Empty;
            customer.ObjectType = customer.ObjectType?.Trim() ?? string.Empty;
            customer.PhoneNumber = customer.PhoneNumber?.Trim() ?? string.Empty;
            customer.Address = customer.Address?.Trim() ?? string.Empty;
            customer.Occupation = customer.Occupation?.Trim() ?? string.Empty;
            customer.ExaminationDate = ToUtcDate(customer.ExaminationDate);
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
            data.Name = customer.Name;
            data.ObjectType = customer.ObjectType;
            data.PhoneNumber = customer.PhoneNumber;
            data.Address = customer.Address;
            data.TaxCode = customer.TaxCode;
            data.Occupation = customer.Occupation;
            data.ExaminationDate = customer.ExaminationDate;
            data.BirthDate = customer.BirthDate;

            await _context.SaveChangesAsync();

            return Ok(data);
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

        private static DateTime ToUtcDate(DateTime value)
        {
            var date = value.Date;
            return value.Kind == DateTimeKind.Local
                ? date.ToUniversalTime()
                : DateTime.SpecifyKind(date, DateTimeKind.Utc);
        }
    }
}
