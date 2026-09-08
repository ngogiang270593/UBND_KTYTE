using backend.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace backend.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly string jwtKey = "APP2026_SECRET_KEY_LOGIN_JWT_123456789";

        public AuthController(AppDbContext context)
        {
            _context = context;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginRequest request)
        {
            var user = await _context.Users
                .FirstOrDefaultAsync(x => x.Username == request.Username);

            if (user == null)
            {
                return Unauthorized(new
                {
                    message = "Sai tài khoản hoặc mật khẩu"
                });
            }

            bool ok = BCrypt.Net.BCrypt.Verify(request.Password, user.Password);

            if (!ok)
            {
                return Unauthorized(new
                {
                    message = "Sai tài khoản hoặc mật khẩu"
                });
            }

            var claims = new[]
            {
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("FullName", user.FullName)
            };

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey)
            );

            var creds = new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256
            );

            var token = new JwtSecurityToken(
                claims: claims,
                expires: DateTime.Now.AddDays(1),
                signingCredentials: creds
            );

            var jwt = new JwtSecurityTokenHandler().WriteToken(token);

            return Ok(new
            {
                token = jwt,
                username = user.Username,
                fullName = user.FullName,
                role = user.Role
            });
        }

        [Authorize]
        [HttpPost("change-password")]
        public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
        {
            var username = User.Identity?.Name;

            if (string.IsNullOrWhiteSpace(username))
            {
                return Unauthorized(new
                {
                    message = "Không xác định được người dùng"
                });
            }

            if (string.IsNullOrWhiteSpace(request.OldPassword))
            {
                return BadRequest(new
                {
                    message = "Vui lòng nhập mật khẩu cũ"
                });
            }

            if (string.IsNullOrWhiteSpace(request.NewPassword))
            {
                return BadRequest(new
                {
                    message = "Vui lòng nhập mật khẩu mới"
                });
            }

            if (request.NewPassword.Length < 6)
            {
                return BadRequest(new
                {
                    message = "Mật khẩu mới phải từ 6 ký tự"
                });
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(x => x.Username == username);

            if (user == null)
            {
                return NotFound(new
                {
                    message = "Không tìm thấy user"
                });
            }

            bool oldPasswordOk = BCrypt.Net.BCrypt.Verify(
                request.OldPassword,
                user.Password
            );

            if (!oldPasswordOk)
            {
                return BadRequest(new
                {
                    message = "Mật khẩu cũ không đúng"
                });
            }

            user.Password = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đổi mật khẩu thành công"
            });
        }
    }

    public class LoginRequest
    {
        public string Username { get; set; } = "";
        public string Password { get; set; } = "";
    }

    public class ChangePasswordRequest
    {
        public string OldPassword { get; set; } = "";
        public string NewPassword { get; set; } = "";
    }
}