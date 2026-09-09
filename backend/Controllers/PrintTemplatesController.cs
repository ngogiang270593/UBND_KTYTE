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
    public class PrintTemplatesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public PrintTemplatesController(AppDbContext context)
        {
            _context = context;
        }

        private string GetTemplateDir()
        {
            var appData = Environment.GetFolderPath(
                Environment.SpecialFolder.LocalApplicationData
            );

            var dir = Path.Combine(appData, "App2026", "Templates");

            Directory.CreateDirectory(dir);

            return dir;
        }

        private string GetTemplateName(string type)
        {
            return type switch
            {
                "PurchaseSheet" => "Bảng kê thu mua",
                "Receipt" => "Phiếu thu",
                _ => type
            };
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var data = await _context.PrintTemplates
                .Where(x => x.TemplateType != "PaymentVoucher")
                .OrderBy(x => x.TemplateType)
                .ToListAsync();

            return Ok(data);
        }
        public class UploadPrintTemplateRequest
        {
            public string TemplateType { get; set; } = "";
            public IFormFile File { get; set; } = null!;
        }
        [HttpPost("upload")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> Upload([FromForm] UploadPrintTemplateRequest request)
        {
            var templateType = request.TemplateType;
            var file = request.File;

            if (templateType == "PaymentVoucher")
                return BadRequest("Chức năng in Phiếu chi đã được loại bỏ.");

            if (string.IsNullOrWhiteSpace(templateType))
                return BadRequest("Thiếu loại mẫu in");

            if (file == null || file.Length == 0)
                return BadRequest("Chưa chọn file");

            var ext = Path.GetExtension(file.FileName).ToLower();

            if (ext != ".xlsx" && ext != ".xlsm")
                return BadRequest("Chỉ hỗ trợ file .xlsx hoặc .xlsm");

            var old = await _context.PrintTemplates
                .FirstOrDefaultAsync(x => x.TemplateType == templateType);

            if (old != null)
            {
                try
                {
                    if (System.IO.File.Exists(old.FilePath))
                    {
                        System.IO.File.Delete(old.FilePath);
                    }
                }
                catch
                {
                    return BadRequest(new
                    {
                        message = "Mẫu cũ đang được mở bởi Excel. Vui lòng đóng file rồi thử lại."
                    });
                }

                _context.PrintTemplates.Remove(old);
            }

            var dir = GetTemplateDir();

            var saveFileName = $"{templateType}_{Guid.NewGuid()}{ext}";
            var savePath = Path.Combine(dir, saveFileName);

            using (var stream = new FileStream(savePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var item = new PrintTemplate
            {
                TemplateName = GetTemplateName(templateType),
                TemplateType = templateType,
                FileName = file.FileName,
                FilePath = savePath,
                UploadedAt = DateTime.Now
            };

            _context.PrintTemplates.Add(item);
            await _context.SaveChangesAsync();

            return Ok(item);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var item = await _context.PrintTemplates.FindAsync(id);

            if (item == null)
                return NotFound();

            try
            {
                if (System.IO.File.Exists(item.FilePath))
                {
                    System.IO.File.Delete(item.FilePath);
                }
            }
            catch
            {
                return BadRequest(new
                {
                    message = "Không thể xóa file mẫu. Hãy đóng file Excel đang mở rồi thử lại."
                });
            }

            _context.PrintTemplates.Remove(item);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Đã xóa mẫu in"
            });
        }

        [HttpGet("download/{id}")]
        public async Task<IActionResult> Download(int id)
        {
            var item = await _context.PrintTemplates
                .FirstOrDefaultAsync(x => x.Id == id);

            if (item == null)
                return NotFound();

            if (!System.IO.File.Exists(item.FilePath))
                return NotFound("File không tồn tại");

            var bytes = await System.IO.File.ReadAllBytesAsync(item.FilePath);

            var ext = Path.GetExtension(item.FileName).ToLower();

            var contentType =
                ext == ".xlsm"
                ? "application/vnd.ms-excel.sheet.macroEnabled.12"
                : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

            return File(
                bytes,
                contentType,
                item.FileName
            );
        }
    }
}