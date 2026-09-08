using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ExcelTemplateController : ControllerBase
    {
        [HttpGet("import-template")]
        public IActionResult ExportImportTemplate()
        {
            using var workbook = new XLWorkbook();
            var worksheet = workbook.Worksheets.Add("DanhSachKham");

            worksheet.Range("A1:J1").Merge();
            worksheet.Cell("A1").Value = "MẪU IMPORT DANH SÁCH KHÁM SỨC KHỎE";
            worksheet.Cell("A1").Style.Font.Bold = true;
            worksheet.Cell("A1").Style.Font.FontSize = 16;
            worksheet.Cell("A1").Style.Font.FontColor = XLColor.White;
            worksheet.Cell("A1").Style.Fill.BackgroundColor = XLColor.FromHtml("#1D4ED8");
            worksheet.Cell("A1").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            worksheet.Row(1).Height = 28;

            worksheet.Range("A2:J2").Merge();
            worksheet.Cell("A2").Value =
                "Nhập dữ liệu từ dòng 5. Nếu không có Căn cước, hệ thống kiểm tra trùng theo Họ tên + Ngày sinh; nếu thiếu Ngày sinh thì dùng Họ tên + Năm sinh.";
            worksheet.Cell("A2").Style.Font.Italic = true;
            worksheet.Cell("A2").Style.Font.FontColor = XLColor.FromHtml("#475569");

            var headers = new[]
            {
                "STT", "Căn cước", "Họ và tên", "Đối tượng", "Số điện thoại",
                "Năm sinh", "Ngày khám", "Địa chỉ", "Nghề nghiệp"
            };
            const int headerRow = 4;
            headers = headers.Append("Ngày sinh").ToArray();

            for (var column = 1; column <= headers.Length; column++)
            {
                worksheet.Cell(headerRow, column).Value = headers[column - 1];
            }

            var headerRange = worksheet.Range(headerRow, 1, headerRow, headers.Length);
            headerRange.Style.Font.Bold = true;
            headerRange.Style.Font.FontColor = XLColor.White;
            headerRange.Style.Fill.BackgroundColor = XLColor.FromHtml("#0F766E");
            headerRange.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            headerRange.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            headerRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            headerRange.Style.Border.InsideBorder = XLBorderStyleValues.Thin;
            worksheet.Row(headerRow).Height = 25;

            const int firstDataRow = 5;
            const int lastDataRow = 204;
            for (var row = firstDataRow; row <= lastDataRow; row++)
            {
                worksheet.Cell(row, 1).Value = row - firstDataRow + 1;
            }

            var dataRange = worksheet.Range(firstDataRow, 1, lastDataRow, headers.Length);
            dataRange.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            dataRange.Style.Border.InsideBorder = XLBorderStyleValues.Hair;
            worksheet.Range(firstDataRow, 2, lastDataRow, 2).Style.NumberFormat.Format = "@";
            worksheet.Range(firstDataRow, 6, lastDataRow, 6).Style.NumberFormat.Format = "0";
            worksheet.Range(firstDataRow, 7, lastDataRow, 7).Style.DateFormat.Format = "dd/MM/yyyy";

            worksheet.Column(1).Width = 8;
            worksheet.Column(2).Width = 20;
            worksheet.Column(3).Width = 28;
            worksheet.Column(4).Width = 18;
            worksheet.Column(5).Width = 16;
            worksheet.Column(6).Width = 14;
            worksheet.Column(7).Width = 16;
            worksheet.Column(8).Width = 16;
            worksheet.Column(9).Width = 34;
            worksheet.Column(10).Width = 24;
            worksheet.SheetView.FreezeRows(headerRow);
            worksheet.Range(headerRow, 1, lastDataRow, headers.Length).SetAutoFilter();

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);

            return File(
                stream.ToArray(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Mau_Import_Kham_Suc_Khoe.xlsx"
            );
        }
    }
}
