export const appModules = [
  { id: "health", title: "Khám sức khỏe", icon: "🩺", links: [
    { key: "customers", label: "Nhập khám sức khỏe", icon: "👤" },
    { key: "importData", label: "Import dữ liệu", icon: "📥" },
    { key: "printVoucher", label: "Danh sách khám", icon: "📋" },
    { key: "healthStatistics", label: "Thống kê", icon: "📊" },
    { key: "healthObjectStatistics", label: "TK Đối tượng", icon: "👥" },
    { key: "examinationPlace", label: "TK Nơi khám", icon: "🏥" },
    { key: "catalog", label: "Danh mục", icon: "📚" },
  ]},
  { id: "campaign", title: "Chiến dịch", icon: "📊", links: [
    { key: "campaignOverview", label: "Tổng quan chiến dịch", icon: "📈" },
    { key: "campaignData", label: "Nhập số liệu chiến dịch", icon: "📝" },
  ]},
  { id: "data-processing", title: "Xử lý data", icon: "🧹", links: [
    { key: "healthDataProcessing", label: "Data khám sức khỏe", icon: "🩺" },
  ]},
  { id: "stats", title: "Thống kê", icon: "📉", links: [
    { key: "consolidatedList", label: "Tổng hợp danh sách", icon: "📊" },
  ]},
  { id: "hospital", title: "Tân Châu", icon: "🏥", links: [
    { key: "tanChauInpatientImport", label: "Import nội trú", icon: "📥" },
    { key: "tanChauInpatientList", label: "Danh sách nội trú", icon: "📋" },
    { key: "tanChauOutpatientImport", label: "Import ngoại trú", icon: "📥" },
    { key: "tanChauOutpatientList", label: "Danh sách ngoại trú", icon: "📋" },
  ]},
  { id: "record", title: "Y bạ", icon: "📒", links: [
    { key: "medicalRecordImport", label: "Import y bạ", icon: "📥" },
    { key: "medicalRecords", label: "Danh sách y bạ", icon: "🗂️" },
  ]},
  { id: "people", title: "Đối tượng xã", icon: "👥", links: [
    { key: "communeSubjectImport", label: "Import đối tượng xã", icon: "📥" },
    { key: "communeSubjectList", label: "Danh sách đối tượng xã", icon: "📋" },
  ]},
  { id: "tan-hoa", title: "Tân Hòa", icon: "🏡", links: [
    { key: "tanHoaImport", label: "Import dữ liệu", icon: "📥" },
    { key: "tanHoaInpatientList", label: "Danh sách nội trú", icon: "📋" },
    { key: "tanHoaNkImport", label: "Import dữ liệu NK", icon: "📥" },
    { key: "tanHoaNkList", label: "Danh sách NK", icon: "📋" },
    { key: "tanHoaPaidKskImport", label: "Import KSK (đóng phí)", icon: "📥" },
    { key: "tanHoaPaidKskList", label: "Danh sách KSK (đóng phí)", icon: "📋" },
    { key: "tanHoaAdmissionTcImport", label: "Import nhập viện TC", icon: "📥" },
    { key: "tanHoaAdmissionTcList", label: "DS nhập viện TC", icon: "📋" },
  ]},
];

export function findModuleByPage(page) {
  return appModules.find((module) => module.links.some((link) => link.key === page));
}
