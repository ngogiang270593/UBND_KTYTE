using backend.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SetupController : ControllerBase
    {
        private readonly AppDbContext _context;

        public SetupController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("reset-admin")]
        public async Task<IActionResult> ResetAdmin()
        {
            var user = await _context.Users.FirstOrDefaultAsync(x => x.Username == "admin");

            if (user == null)
                return NotFound("Không thấy user admin");

            user.Password = BCrypt.Net.BCrypt.HashPassword("123456");
            user.FullName = "Quản trị viên";
            user.Role = "Admin";

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Reset admin OK",
                username = user.Username,
                newPassword = "123456"
            });
        }
    }
}