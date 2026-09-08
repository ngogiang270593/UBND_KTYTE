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
    public class CampaignStatsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public CampaignStatsController(AppDbContext context) => _context = context;

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(await _context.CampaignHamletStats.AsNoTracking().ToListAsync());

        [HttpPut]
        public async Task<IActionResult> Save([FromBody] List<CampaignHamletStat> requests)
        {
            var validHamletIds = await _context.CatalogItems.Where(x => x.Category == "hamlet").Select(x => x.Id).ToListAsync();
            foreach (var request in requests)
            {
                if (!validHamletIds.Contains(request.HamletId)) continue;
                var item = await _context.CampaignHamletStats.FirstOrDefaultAsync(x => x.HamletId == request.HamletId);
                if (item == null)
                {
                    item = new CampaignHamletStat { HamletId = request.HamletId };
                    _context.CampaignHamletStats.Add(item);
                }
                item.TargetCount = Math.Max(0, request.TargetCount);
                item.InformationIssuedCount = Math.Max(0, request.InformationIssuedCount);
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã lưu số liệu chiến dịch." });
        }
    }
}
