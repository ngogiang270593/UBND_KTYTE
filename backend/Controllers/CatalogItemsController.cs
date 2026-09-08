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
    public class CatalogItemsController : ControllerBase
    {
        private static readonly string[] ValidCategories = { "objectType", "occupation", "hamlet", "group" };
        private static readonly string[] CategoriesWithDefault = { "objectType", "hamlet", "group" };
        private readonly AppDbContext _context;

        public CatalogItemsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetAll(string category, string? keyword)
        {
            if (!ValidCategories.Contains(category)) return BadRequest(new { message = "Loại danh mục không hợp lệ." });

            var query = _context.CatalogItems.AsNoTracking().Where(x => x.Category == category);
            if (!string.IsNullOrWhiteSpace(keyword))
            {
                var value = keyword.Trim().ToLower();
                query = query.Where(x => AppDbContext.UnicodeLower(x.Name).Contains(value));
            }

            return Ok(await query.OrderBy(x => x.Name).ToListAsync());
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CatalogItem item)
        {
            if (!ValidCategories.Contains(item.Category)) return BadRequest(new { message = "Loại danh mục không hợp lệ." });
            item.Name = (item.Name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(item.Name)) return BadRequest(new { message = "Tên danh mục không được để trống." });
            if (await Exists(item.Category, item.Name)) return Conflict(new { message = "Tên này đã tồn tại trong danh mục." });

            if (!CategoriesWithDefault.Contains(item.Category)) item.IsDefault = false;
            if (item.IsDefault)
            {
                await _context.CatalogItems
                    .Where(x => x.Category == item.Category && x.IsDefault)
                    .ExecuteUpdateAsync(x => x.SetProperty(item => item.IsDefault, false));
            }

            _context.CatalogItems.Add(item);
            await _context.SaveChangesAsync();
            return Ok(item);
        }

        [HttpPut("{id:int}")]
        public async Task<IActionResult> Update(int id, [FromBody] CatalogItem request)
        {
            var item = await _context.CatalogItems.FindAsync(id);
            if (item == null) return NotFound(new { message = "Không tìm thấy danh mục cần sửa." });

            var name = (request.Name ?? string.Empty).Trim();
            if (string.IsNullOrWhiteSpace(name)) return BadRequest(new { message = "Tên danh mục không được để trống." });
            if (await Exists(item.Category, name, id)) return Conflict(new { message = "Tên này đã tồn tại trong danh mục." });

            item.Name = name;
            item.IsDefault = CategoriesWithDefault.Contains(item.Category) && request.IsDefault;
            if (item.IsDefault)
            {
                await _context.CatalogItems
                    .Where(x => x.Category == item.Category && x.Id != id && x.IsDefault)
                    .ExecuteUpdateAsync(x => x.SetProperty(other => other.IsDefault, false));
            }
            await _context.SaveChangesAsync();
            return Ok(item);
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _context.CatalogItems.FindAsync(id);
            if (item == null) return NotFound(new { message = "Không tìm thấy danh mục cần xóa." });

            _context.CatalogItems.Remove(item);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã xóa danh mục." });
        }

        private Task<bool> Exists(string category, string name, int? exceptId = null)
        {
            var normalized = name.ToLower();
            return _context.CatalogItems.AnyAsync(x =>
                x.Category == category &&
                AppDbContext.UnicodeLower(x.Name) == normalized &&
                (!exceptId.HasValue || x.Id != exceptId.Value));
        }
    }
}
