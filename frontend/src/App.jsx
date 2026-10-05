import TanHoaAdmissionTcListPage from "./TanHoaAdmissionTcListPage";
import TanHoaAdmissionTcImportPage from "./TanHoaAdmissionTcImportPage";
import TanHoaPaidKskListPage from "./TanHoaPaidKskListPage";
import TanHoaPaidKskImportPage from "./TanHoaPaidKskImportPage";
import TanHoaNkImportPage from "./TanHoaNkImportPage";
import TanHoaNkListPage from "./TanHoaNkListPage";
import TanHoaInpatientListPage from "./TanHoaInpatientListPage";
import TanHoaImportPage from "./TanHoaImportPage";
import { useEffect, useState } from "react";
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
import ElderlyImportPage from "./ElderlyImportPage";
import TtytKvTcImportPage from "./TtytKvTcImportPage";
import UpdatedInformationImportPage from "./UpdatedInformationImportPage";
import ExaminationPlacePage from "./ExaminationPlacePage";
import HealthStatisticsPage from "./HealthStatisticsPage";
import HealthObjectStatisticsPage from "./HealthObjectStatisticsPage";
import TnbqModule from "./TnbqModule";
import TnbqSurveyPage from "./TnbqSurveyPage";
import TnbqSurveyStatisticsPage from "./TnbqSurveyStatisticsPage";
import TnbqCatalogPage from "./TnbqCatalogPage";
import UserManagementPage from "./UserManagementPage";
import OfficeMeetingsPage from "./OfficeMeetingsPage";
import OfficeMeetingCatalogPage from "./OfficeMeetingCatalogPage";
import NationwideHealthStatisticsPage from "./NationwideHealthStatisticsPage";
import { appModules, findModuleByPage } from "./navigationConfig";
import api from "./api";
function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedModule, setSelectedModule] = useState(null);
  const [selectedObjectType, setSelectedObjectType] = useState(null);
  const [selectedExaminationPlace, setSelectedExaminationPlace] = useState(null);

  const [access, setAccess] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const [accessRetry, setAccessRetry] = useState(0);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const refreshAccess = () => api.get("/Auth/me").then(({ data }) => {
      if (!cancelled) { setAccess({ token, profile: data }); setAccessError(null); }
    }).catch((error) => {
      if (cancelled) return;
      setAccess(null);
      setAccessError({ token, message: error.response?.data?.message || "Không thể kiểm tra quyền truy cập. Vui lòng thử lại." });
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        setToken(null);
      }
    });
    refreshAccess();
    window.addEventListener("focus", refreshAccess);
    const interval = window.setInterval(refreshAccess, 30000);
    return () => { cancelled = true; window.removeEventListener("focus", refreshAccess); window.clearInterval(interval); };
  }, [token, accessRetry]);

  const logout = () => {
    sessionStorage.clear();
    localStorage.clear(); // xóa token còn sót
    setToken(null);
    setAccess(null);
    setAccessError(null);
    setActivePage("dashboard");
    setSelectedModule(null);
  };

  if (!token) {
    return <Login onLogin={setToken} />;
  }

  if (accessError?.token === token) return <div className="p-4">
    <div className="alert alert-danger" role="alert">{accessError.message}</div>
    <button className="btn btn-primary me-2" onClick={() => { setAccessError(null); setAccessRetry((value) => value + 1); }}>Thử lại</button>
    <button className="btn btn-outline-secondary" onClick={logout}>Đăng xuất</button>
  </div>;
  if (access?.token !== token) return <p className="p-4" role="status">Đang kiểm tra quyền truy cập...</p>;
  const profile = access.profile;
  const modules = appModules.filter((module) => profile.isSystemAdmin || profile.modules.includes(module.id));
  const pageModule = findModuleByPage(activePage);
  const canOpenPage = activePage === "dashboard" || activePage === "changePassword"
    || (activePage === "printTemplates" && modules.some((module) => module.id === "health"))
    || (pageModule && modules.some((module) => module.id === pageModule.id));

  const renderPage = () => {
    if (!canOpenPage) return <div className="alert alert-warning">Bạn không còn quyền truy cập chức năng này. Hãy chọn module khác trên Dashboard.</div>;
    if (activePage === "users") return <UserManagementPage />;
    if (activePage === "tnbqSurvey") return <TnbqSurveyPage />;
    if (activePage === "tnbqSurveyStatistics") return <TnbqSurveyStatisticsPage />;
    if (activePage === "tnbqCatalog") return <TnbqCatalogPage />;
    if (activePage === "tnbqList" || activePage === "tnbqImport") return <TnbqModule mode={activePage === "tnbqImport" ? "import" : "list"} onImported={() => setActivePage("tnbqList")} />;
    if (activePage === "tanHoaAdmissionTcList") return <TanHoaAdmissionTcListPage />;
    if (activePage === "tanHoaAdmissionTcImport") return <TanHoaAdmissionTcImportPage />;
    if (activePage === "tanHoaPaidKskList") return <TanHoaPaidKskListPage />;
    if (activePage === "tanHoaPaidKskImport") return <TanHoaPaidKskImportPage />;
    if (activePage === "tanHoaNkImport") return <TanHoaNkImportPage />;
    if (activePage === "tanHoaNkList") return <TanHoaNkListPage />;
    if (activePage === "tanHoaInpatientList") return <TanHoaInpatientListPage />;
    if (activePage === "tanHoaImport") return <TanHoaImportPage />;
    if (activePage === "dashboard") return <DashboardHome modules={modules} selectedModule={selectedModule} onSelectModule={(moduleId) => { setSelectedModule(moduleId); setActivePage(moduleId === "health" ? "customers" : moduleId === "tnbq" ? "tnbqList" : moduleId === "system" ? "users" : moduleId === "office" ? "officeMeetings" : "dashboard"); }} />;
    if (activePage === "campaignOverview") return <CampaignDashboard />;
    if (activePage === "campaignData") return <CampaignDataPage />;
    if (activePage === "healthObjectStatistics") return <HealthObjectStatisticsPage key={selectedObjectType ?? "total"} initialObjectType={selectedObjectType} />;
    if (activePage === "officeMeetings") return <OfficeMeetingsPage profile={profile} />;
    if (activePage === "officeMeetingCatalog") return <OfficeMeetingCatalogPage />;
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
    if (activePage === "nationwideHealthStatistics") return <NationwideHealthStatisticsPage />;
    if (activePage === "printTemplates") return <PrintTemplatePage />;
    if (activePage === "printVoucher") return <PrintVoucherPage />;
    if (activePage === "examinationPlace") return <ExaminationPlacePage key={selectedExaminationPlace === null ? "total" : `place:${selectedExaminationPlace}`} initialPlace={selectedExaminationPlace} />;
    if (activePage === "healthStatistics") return <HealthStatisticsPage onViewExaminationPlace={(place) => { setSelectedExaminationPlace(place); setActivePage("examinationPlace"); }} onViewObject={(objectType) => { setSelectedObjectType(objectType); setActivePage("healthObjectStatistics"); }} onViewPlace={(hamletId) => { sessionStorage.setItem("printVoucherHamlet", String(hamletId)); setActivePage("printVoucher"); }} />;
    if (activePage === "changePassword") return <ChangePasswordPage />;
    if (activePage === "catalog") return <CatalogPage />;
    if (activePage === "healthDataProcessing") return <HealthDataProcessingPage />;
    if (activePage === "elderlyImport") return <ElderlyImportPage />;
    if (activePage === "ttytKvTcImport") return <TtytKvTcImportPage />;
    if (activePage === "updatedInformationImport") return <UpdatedInformationImportPage />;
    return (
      <div className="alert alert-info">
        Chức năng này sẽ làm sau.
      </div>
    );
  };

  return (
    <AdminLayout
      modules={modules}
      profile={profile}
      activePage={activePage}
      setActivePage={(page) => { setSelectedExaminationPlace(null); setSelectedObjectType(null); setActivePage(page); }}
      selectedModule={selectedModule}
      setSelectedModule={setSelectedModule}
      onLogout={logout}
    >
      {renderPage()}
    </AdminLayout>
  );
}

export default App;
