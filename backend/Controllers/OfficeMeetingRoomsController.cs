using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace backend.Controllers;
[Authorize,ApiController,Route("api/[controller]")]
public sealed class OfficeMeetingRoomsController(AppDbContext db) : ControllerBase
{
 const string Category="officeMeetingRoom";
 [HttpGet] public async Task<IActionResult> GetAll(CancellationToken ct)=>Ok(await db.CatalogItems.AsNoTracking().Where(x=>x.Category==Category).OrderBy(x=>x.Name).Select(x=>new{x.Id,x.Name}).ToListAsync(ct));
 [HttpPost] public async Task<IActionResult> Create([FromBody] RoomRequest request,CancellationToken ct){var name=(request.Name??"").Trim();if(name.Length<1||name.Length>200)return BadRequest(new{message="Tên phòng họp không hợp lệ."});if(await db.CatalogItems.AnyAsync(x=>x.Category==Category&&x.Name==name,ct))return Conflict(new{message="Phòng họp đã tồn tại."});var item=new CatalogItem{Category=Category,Name=name};db.CatalogItems.Add(item);await db.SaveChangesAsync(ct);return Ok(new{item.Id,item.Name});}
 [HttpPut("{id:int}")] public async Task<IActionResult> Update(int id,[FromBody] RoomRequest request,CancellationToken ct){var item=await db.CatalogItems.SingleOrDefaultAsync(x=>x.Id==id&&x.Category==Category,ct);if(item is null)return NotFound();var name=(request.Name??"").Trim();if(name.Length<1||name.Length>200)return BadRequest(new{message="Tên phòng họp không hợp lệ."});item.Name=name;await db.SaveChangesAsync(ct);return Ok(new{item.Id,item.Name});}
 [HttpDelete("{id:int}")] public async Task<IActionResult> Delete(int id,CancellationToken ct){var item=await db.CatalogItems.SingleOrDefaultAsync(x=>x.Id==id&&x.Category==Category,ct);if(item is null)return NotFound();db.CatalogItems.Remove(item);await db.SaveChangesAsync(ct);return NoContent();}
}
public sealed record RoomRequest(string? Name);
