using System.ComponentModel.DataAnnotations;

namespace backend.Models
{
    public class CampaignHamletStat
    {
        public int Id { get; set; }
        public int HamletId { get; set; }
        [Range(0, int.MaxValue)] public int TargetCount { get; set; }
        [Range(0, int.MaxValue)] public int InformationIssuedCount { get; set; }
    }
}
