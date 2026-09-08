namespace backend.Models
{
    public class Employee
    {
        public int Id { get; set; }
        public string Code { get; set; } = "";
        public string Name { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Address { get; set; } = "";
    }
}