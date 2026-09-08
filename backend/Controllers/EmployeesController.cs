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
    public class EmployeesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public EmployeesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            return Ok(await _context.Employees.ToListAsync());
        }

        [HttpPost]
        public async Task<IActionResult> Create(Employee employee)
        {
            _context.Employees.Add(employee);
            await _context.SaveChangesAsync();
            return Ok(employee);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, Employee employee)
        {
            var data = await _context.Employees.FindAsync(id);
            if (data == null) return NotFound();

            data.Code = employee.Code;
            data.Name = employee.Name;
            data.Phone = employee.Phone;
            data.Address = employee.Address;

            await _context.SaveChangesAsync();
            return Ok(data);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var data = await _context.Employees.FindAsync(id);
            if (data == null) return NotFound();

            _context.Employees.Remove(data);
            await _context.SaveChangesAsync();
            return Ok();
        }
    }
}