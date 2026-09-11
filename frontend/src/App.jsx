import { useState } from "react";
import Login from "./Login";
import AdminLayout from "./AdminLayout";
import CustomerPage from "./CustomerPage";
import ImportDataPage from "./ImportDataPage";
import PrintTemplatePage from "./PrintTemplatePage";
import PrintVoucherPage from "./PrintVoucherPage";
import ChangePasswordPage from "./ChangePasswordPage";
import CatalogPage from "./CatalogPage";
import CampaignDashboard from "./CampaignDashboard";
import CampaignDataPage from "./CampaignDataPage";
import MedicalRecordImportPage from "./MedicalRecordImportPage";
import MedicalRecordListPage from "./MedicalRecordListPage";
import TanChauInpatientImportPage from "./TanChauInpatientImportPage";
import TanChauInpatientListPage from "./TanChauInpatientListPage";
import TanChauOutpatientImportPage from "./TanChauOutpatientImportPage";
import TanChauOutpatientListPage from "./TanChauOutpatientListPage";
import ConsolidatedListPage from "./ConsolidatedListPage";
import CommuneSubjectImportPage from "./CommuneSubjectImportPage";
import CommuneSubjectListPage from "./CommuneSubjectListPage";
import DashboardHome from "./DashboardHome";
import HealthDataProcessingPage from "./HealthDataProcessingPage";
import ExaminationPlacePage from "./ExaminationPlacePage";
import HealthStatisticsPage from "./HealthStatisticsPage";
function App() {
  const [token, setToken] = useState(sessionStorage.getItem("token"));
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedModule, setSelectedModule] = useState(null);

  const logout = () => {
    sessionStorage.clear();
    localStorage.clear(); // xóa token cũ còn sót
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  const renderPage = () => {
    if (activePage === "dashboard") return <DashboardHome selectedModule={selectedModule} onSelectModule={(moduleId) => { setSelectedModule(moduleId); setActivePage(moduleId === "health" ? "healthStatistics" : "dashboard"); }} />;
    if (activePage === "campaignOverview") return <CampaignDashboard />;
    if (activePage === "campaignData") return <CampaignDataPage />;
    if (activePage === "customers") return <CustomerPage />;
    if (activePage === "importData") return <ImportDataPage />;
    if (activePage === "communeSubjectImport") return <CommuneSubjectImportPage />;
    if (activePage === "communeSubjectList") return <CommuneSubjectListPage />;
    if (activePage === "medicalRecordImport") return <MedicalRecordImportPage />;
    if (activePage === "medicalRecords") return <MedicalRecordListPage />;
    if (activePage === "tanChauInpatientImport") return <TanChauInpatientImportPage />;
    if (activePage === "tanChauInpatientList") return <TanChauInpatientListPage />;
    if (activePage === "tanChauOutpatientImport") return <TanChauOutpatientImportPage />;
    if (activePage === "tanChauOutpatientList") return <TanChauOutpatientListPage />;
    if (activePage === "consolidatedList") return <ConsolidatedListPage />;
    if (activePage === "printTemplates") return <PrintTemplatePage />;
    if (activePage === "printVoucher") return <PrintVoucherPage />;
    if (activePage === "examinationPlace") return <ExaminationPlacePage />;
    if (activePage === "healthStatistics") return <HealthStatisticsPage onViewPlace={(hamletId) => { sessionStorage.setItem("printVoucherHamlet", String(hamletId)); setActivePage("printVoucher"); }} />;
    if (activePage === "changePassword") return <ChangePasswordPage />;
    if (activePage === "catalog") return <CatalogPage />;
    if (activePage === "healthDataProcessing") return <HealthDataProcessingPage />;
    return (
      <div className="alert alert-info">
        Chức năng này sẽ làm sau.
      </div>
    );
  };

  return (
    <AdminLayout
      activePage={activePage}
      setActivePage={setActivePage}
      selectedModule={selectedModule}
      setSelectedModule={setSelectedModule}
      onLogout={logout}
    >
      {renderPage()}
    </AdminLayout>
  );
}

export default App;
