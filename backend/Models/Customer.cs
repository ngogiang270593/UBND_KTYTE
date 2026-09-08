using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace backend.Models
{
    public class Customer
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Căn cước là bắt buộc.")]
        public string Code { get; set; } = string.Empty;

        [Required(ErrorMessage = "Họ và tên là bắt buộc.")]
        public string Name { get; set; } = string.Empty;

        public string ObjectType { get; set; } = string.Empty;

        public string PhoneNumber { get; set; } = string.Empty;

        public string Address { get; set; } = string.Empty;

        [Required(ErrorMessage = "Năm sinh là bắt buộc.")]
        public string TaxCode { get; set; } = string.Empty;

        [Column("Email")]
        public string Occupation { get; set; } = string.Empty;

        [Required(ErrorMessage = "Ngày khám là bắt buộc.")]
        public DateTime ExaminationDate { get; set; }

        public DateTime? BirthDate { get; set; }
    }
}
