import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import api from "./api";
import { useNotification } from "./NotificationProvider";

function ImportDataPage() {
  const { confirm } = useNotification();
  const [rows, setRows] = useState([]);
  const [savedRows, setSavedRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [searchForm, setSearchForm] = useState({
    code: "",
    name: "",
    fromDate: null,
    toDate: null,
    address: "",
    objectType: "",
    occupation: "",
  });

  const fileInputRef = useRef(null);

  const normalizeText = (value) => String(value ?? "").trim();

  const normalizeCitizenCode = (value) => {
    const digits = normalizeText(value).replace(/\D/g, "");
    return digits.length === 11 ? `0${digits}` : digits;
  };

  const normalizeHeader = (value) =>
    normalizeText(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, "d")
      .replace(/\s+/g, " ")
      .toLowerCase();

  const toApiDate = (value) => {
    if (!value) return null;

    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const buildSearchParams = (filters) => {
    const params = {};

    if (filters.code?.trim()) params.code = filters.code.trim();
    if (filters.name?.trim()) params.name = filters.name.trim();
    if (filters.address?.trim()) params.address = filters.address.trim();
    if (filters.objectType?.trim()) params.objectType = filters.objectType.trim();
    if (filters.occupation?.trim()) params.occupation = filters.occupation.trim();
    if (filters.fromDate) params.fromDate = toApiDate(filters.fromDate);
    if (filters.toDate) params.toDate = toApiDate(filters.toDate);

    return params;
  };

  const loadSavedRows = async (filters = searchForm) => {
    try {
      const res = await api.get("/ImportData/customer-rows", {
        params: buildSearchParams(filters),
      });
      setSavedRows(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
      setMessage("Không tải được danh sách khám sức khỏe đã lưu.");
    }
  };

  useEffect(() => {
    loadSavedRows({});
  }, []);

  const excelDateToIso = (value, use1904DateSystem = false) => {
    if (value === null || value === undefined || value === "") return "";

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");

      return `${year}-${month}-${day}`;
    }

    if (typeof value === "number") {
      // Giữ số seri gốc của Excel và dùng đúng hệ ngày của workbook.
      // Không tạo Date ở đây vì Date có thể bị lệch một ngày theo múi giờ.
      const parsed = XLSX.SSF.parse_date_code(value, {
        date1904: use1904DateSystem,
      });

      if (!parsed) return "";

      const date = new Date(parsed.y, parsed.m - 1, parsed.d);

      if (
        date.getFullYear() !== parsed.y ||
        date.getMonth() !== parsed.m - 1 ||
        date.getDate() !== parsed.d
      ) {
        return "";
      }

      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(
        parsed.d
      ).padStart(2, "0")}`;
    }

    const text = normalizeText(value);

    // dd/MM/yyyy hoặc d/M/yyyy
    let match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

    if (match) {
      const day = Number(match[1]);
      const month = Number(match[2]);
      const year = Number(match[3]);
      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return "";
      }

      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`;
    }

    // yyyy-MM-dd
    match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return "";
      }

      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`;
    }

    return "";
  };

  const formatDateVN = (value) => {
    if (!value) return "";

    const text = String(value).substring(0, 10);
    const parts = text.split("-");

    if (parts.length !== 3) return String(value);

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const findHeaderRowIndex = (sheetRows) =>
    sheetRows.findIndex((row) => {
      const headers = (row || []).map(normalizeHeader);

      return (
        headers.includes("stt") &&
        headers.some((item) => item === "can cuoc" || item === "cccd") &&
        headers.some(
          (item) =>
            item === "ho va ten" ||
            item === "ho ten" ||
            item === "ten khach hang"
        )
      );
    });

  const buildColumnMap = (headerRow) => {
    const map = {};

    headerRow.forEach((value, index) => {
      const header = normalizeHeader(value);

      if (header === "stt") map.stt = index;

      if (
        header === "can cuoc" ||
        header === "cccd" ||
        header === "ma khach hang"
      ) {
        map.code = index;
      }

      if (
        header === "ho va ten" ||
        header === "ho ten" ||
        header === "ten khach hang"
      ) {
        map.name = index;
      }

      if (
        header === "doi tuong"
      ) {
        map.objectType = index;
      }

      if (
        header === "so dien thoai" ||
        header === "dien thoai" ||
        header === "sdt"
      ) {
        map.phoneNumber = index;
      }

      if (header === "nam sinh") map.taxCode = index;

      if (header === "ngay sinh") map.birthDate = index;

      if (header === "ngay kham") map.examinationDate = index;

      if (header === "dia chi") map.address = index;

      if (header === "nghe nghiep") map.occupation = index;
    });

    return map;
  };

  const validateRows = (dataRows) => {
    const existingCodes = new Set(
      savedRows.map((item) => normalizeText(item.code).toLowerCase())
    );

    const buildNameBirthDateKey = (name, birthDate) =>
      `${normalizeText(name).replace(/\s+/g, " ").toLocaleLowerCase("vi-VN")}\u001f${String(
        birthDate ?? ""
      ).substring(0, 10)}`;

    const existingNameBirthDateKeys = new Set(
      savedRows
        .filter((item) => item.name && item.birthDate)
        .map((item) => buildNameBirthDateKey(item.name, item.birthDate))
    );

    const buildNameBirthYearKey = (name, birthYear) =>
      `${normalizeText(name).replace(/\s+/g, " ").toLocaleLowerCase("vi-VN")}\u001f${normalizeText(
        birthYear
      )}`;

    const existingNameBirthYearKeys = new Set(
      savedRows
        .filter((item) => item.name && item.taxCode)
        .map((item) => buildNameBirthYearKey(item.name, item.taxCode))
    );

    const codesInFile = new Set();
    const nameBirthDateKeysInFile = new Set();
    const nameBirthYearKeysInFile = new Set();
    const currentYear = new Date().getFullYear();

    return dataRows.map((row, index) => {
      const errors = [];
      const codeKey = normalizeCitizenCode(row.code);

      if (!row.name) errors.push("Thiếu Họ và tên");

      if (!row.taxCode) {
        errors.push("Thiếu Năm sinh");
      } else {
        const year = Number(row.taxCode);

        if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
          errors.push(`Năm sinh phải từ 1900 đến ${currentYear}`);
        }
      }

      if (!row.examinationDate) {
        errors.push("Ngày khám không hợp lệ");
      } else {
        const examinationDate = new Date(`${row.examinationDate}T00:00:00`);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (examinationDate > today) {
          errors.push("Ngày khám không được lớn hơn ngày hiện tại");
        }
      }

      if (row.code) {
        if (existingCodes.has(codeKey)) {
          errors.push("Căn cước đã tồn tại trong hệ thống");
        } else if (codesInFile.has(codeKey)) {
          errors.push("Căn cước bị trùng trong file");
        } else {
          codesInFile.add(codeKey);
        }
      } else if (row.name) {
        const nameBirthYearKey = buildNameBirthYearKey(row.name, row.taxCode);

        if (row.birthDate) {
          const nameBirthDateKey = buildNameBirthDateKey(row.name, row.birthDate);

          if (existingNameBirthDateKeys.has(nameBirthDateKey)) {
            errors.push("Họ và tên, Ngày sinh đã tồn tại trong hệ thống");
          } else if (nameBirthDateKeysInFile.has(nameBirthDateKey)) {
            errors.push("Họ và tên, Ngày sinh bị trùng trong file");
          } else if (nameBirthYearKeysInFile.has(nameBirthYearKey)) {
            errors.push("Họ và tên, Năm sinh bị trùng trong file");
          } else {
            nameBirthDateKeysInFile.add(nameBirthDateKey);
          }

          nameBirthYearKeysInFile.add(nameBirthYearKey);
        } else if (existingNameBirthYearKeys.has(nameBirthYearKey)) {
          errors.push("Họ và tên, Năm sinh đã tồn tại trong hệ thống");
        } else if (nameBirthYearKeysInFile.has(nameBirthYearKey)) {
          errors.push("Họ và tên, Năm sinh bị trùng trong file");
        } else {
          nameBirthYearKeysInFile.add(nameBirthYearKey);
        }
      }

      return {
        ...row,
        displayStt: row.stt || index + 1,
        errors,
        isValid: errors.length === 0,
      };
    });
  };

  const downloadTemplate = async () => {
    try {
      setMessage("");
      const response = await api.get("/ExcelTemplate/import-template", {
        responseType: "blob",
      });

      if (!response?.data) {
        throw new Error(`Không tìm thấy file mẫu (${response.status}).`);
      }

      const blob = response.data;

      // File .xlsx hợp lệ có chữ ký ZIP "PK".
      const signature = new Uint8Array(
        await blob.slice(0, 2).arrayBuffer()
      );

      if (signature[0] !== 0x50 || signature[1] !== 0x4b) {
        throw new Error(
          "Đường dẫn đang trả về trang HTML thay vì file Excel."
        );
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "Mau_Import_Kham_Suc_Khoe.xlsx";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Lỗi tải file mẫu:", error);

      setMessage(
        error?.message ||
          "Không tải được file mẫu. Kiểm tra thư mục public/templates."
      );
    }
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setFileName(file.name);
    setRows([]);
    setMessage("");

    try {
      const buffer = await file.arrayBuffer();

      const workbook = XLSX.read(buffer, {
        type: "array",
        // Không đổi ô ngày thành JavaScript Date: Date phụ thuộc múi giờ và
        // có thể hiển thị khác một ngày so với ngày gốc trong Excel.
        cellDates: false,
      });

      if (!workbook.SheetNames?.length) {
        throw new Error("File Excel không có sheet.");
      }

      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const use1904DateSystem =
        workbook.Workbook?.WBProps?.date1904 === true ||
        workbook.Workbook?.WBProps?.date1904 === 1 ||
        workbook.Workbook?.WBProps?.date1904 === "1";

      /*
        blankrows: true rất quan trọng:
        SheetJS giữ nguyên số dòng thật trong Excel,
        không làm lệch dòng 6 thành dòng 7.
      */
      const sheetRows = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: "",
        raw: true,
        blankrows: true,
      });

      const headerRowIndex = findHeaderRowIndex(sheetRows);

      if (headerRowIndex === -1) {
        throw new Error(
          "Không tìm thấy dòng tiêu đề STT - Căn cước - Họ và tên."
        );
      }

      const columnMap = buildColumnMap(sheetRows[headerRowIndex]);

      if (
        columnMap.code === undefined ||
        columnMap.name === undefined ||
        columnMap.taxCode === undefined ||
        columnMap.examinationDate === undefined
      ) {
        throw new Error(
          "File thiếu một trong các cột bắt buộc: Căn cước, Họ và tên, Năm sinh, Ngày khám."
        );
      }

      // Dòng ngay sau header là dòng dữ liệu đầu tiên.
      const dataRows = sheetRows.slice(headerRowIndex + 1);

      const mappedRows = dataRows
        .map((cells, index) => {
          // Số dòng thật trong Excel, bắt đầu từ 1.
          const excelLine = headerRowIndex + index + 2;
          const birthYear = normalizeText(cells[columnMap.taxCode]);

          return {
            excelLine,

            stt:
              columnMap.stt !== undefined
                ? normalizeText(cells[columnMap.stt])
                : "",

            code: normalizeCitizenCode(cells[columnMap.code]),
            name: normalizeText(cells[columnMap.name]),

            objectType: columnMap.objectType !== undefined
                ? normalizeText(cells[columnMap.objectType])
                : null,

            phoneNumber: columnMap.phoneNumber !== undefined
              ? normalizeText(cells[columnMap.phoneNumber])
              : null,

            taxCode: birthYear,

            birthDate:
              columnMap.birthDate !== undefined
                ? excelDateToIso(cells[columnMap.birthDate], use1904DateSystem)
                : null,

            examinationDate: excelDateToIso(
              cells[columnMap.examinationDate],
              use1904DateSystem
            ),

            address:
              columnMap.address !== undefined
                ? normalizeText(cells[columnMap.address])
                : null,

            occupation:
              columnMap.occupation !== undefined
                ? normalizeText(cells[columnMap.occupation])
                : null,

            sourceFileName: file.name,
          };
        })
        .filter(
          (row) =>
            row.code ||
            row.name ||
            row.objectType ||
            row.phoneNumber ||
            row.taxCode ||
            row.birthDate ||
            row.examinationDate ||
            row.address ||
            row.occupation
        );

      if (mappedRows.length === 0) {
        throw new Error(
          `Không tìm thấy dữ liệu. Hãy nhập dữ liệu từ dòng ${
            headerRowIndex + 2
          } trở xuống.`
        );
      }

      const validatedRows = validateRows(mappedRows);

      setRows(validatedRows);

      const validCount = validatedRows.filter((row) => row.isValid).length;
      const invalidCount = validatedRows.length - validCount;

      setMessage(
        `Đã đọc ${validatedRows.length} dòng từ file Excel.\n` +
          `Hợp lệ: ${validCount} dòng.\n` +
          `Có lỗi: ${invalidCount} dòng.`
      );
    } catch (error) {
      console.error("Lỗi đọc Excel:", error);

      setRows([]);
      setMessage(
        error?.message ||
          "Không đọc được file Excel. Vui lòng dùng đúng file mẫu."
      );
    }
  };

  const saveToDb = async () => {
    if (rows.length === 0) {
      setMessage("Chưa có dữ liệu để lưu.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const payload = rows.map((row) => ({
        excelLine: row.excelLine,
        code: row.code,
        name: row.name,
        objectType: row.objectType,
        phoneNumber: row.phoneNumber,
        taxCode: row.taxCode,
        birthDate: row.birthDate || null,
        examinationDate: row.examinationDate || null,
        address: row.address,
        occupation: row.occupation,
        sourceFileName: row.sourceFileName,
      }));

      const res = await api.post("/ImportData/customer-rows", payload);
      const data = res.data;

      setMessage(
        `${data.message}\n` +
          `Tổng số dòng: ${data.totalCount || 0}\n` +
          `Đã lưu: ${data.savedCount || 0}\n` +
          `Dòng đã lưu: ${data.savedLines?.join(", ") || "Không có"}\n` +
          `Dòng lỗi: ${data.errorCount || 0}\n` +
          `${data.errors?.join("\n") || ""}`
      );

      await loadSavedRows();

      if ((data.errorCount || 0) === 0) {
        clearPreview(false);
      }
    } catch (error) {
      console.error("Lỗi lưu dữ liệu:", error);

      const data = error.response?.data;

      setMessage(
        data?.message ||
          data?.title ||
          "Import thất bại. Vui lòng kiểm tra dữ liệu."
      );
    } finally {
      setLoading(false);
    }
  };

  const deleteOne = async (row) => {
    const confirmed = await confirm({
      title: "Xóa dữ liệu khám sức khỏe?",
      message: `Xóa dữ liệu của "${row.name}"?\nCăn cước: ${row.code}\n\nThao tác này không thể hoàn tác.`,
      confirmText: "Xóa dữ liệu",
    });

    if (!confirmed) return;

    setDeletingId(row.id);
    setMessage("");

    try {
      const res = await api.delete(`/ImportData/customer-rows/${row.id}`);

      setSavedRows((currentRows) =>
        currentRows.filter((item) => item.id !== row.id)
      );

      setMessage(res.data?.message || "Đã xóa dữ liệu.");
    } catch (error) {
      console.error("Lỗi xóa dữ liệu:", error);

      setMessage(
        error.response?.data?.message ||
          "Không xóa được dữ liệu. Vui lòng thử lại."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const clearAllSavedRows = async () => {
    if (savedRows.length === 0) {
      setMessage("Danh sách hiện đang trống.");
      return;
    }

    const confirmed = await confirm({
      title: "Xóa toàn bộ dữ liệu?",
      message: `Bạn sắp xóa toàn bộ ${savedRows.length} dòng dữ liệu khám sức khỏe.\n\nDữ liệu sau khi xóa không thể khôi phục.`,
      confirmText: "Xóa toàn bộ",
    });

    if (!confirmed) return;

    setClearingAll(true);
    setMessage("");

    try {
      const res = await api.delete("/ImportData/customer-rows", {
        params: buildSearchParams(searchForm),
      });

      const verifyRes = await api.get("/ImportData/customer-rows", {
        params: buildSearchParams(searchForm),
      });
      setSavedRows(Array.isArray(verifyRes.data) ? verifyRes.data : []);

      setMessage(
        `${res.data?.message || "Đã xóa toàn bộ dữ liệu."}\n` +
          `Số dòng đã xóa: ${res.data?.count || 0}.`
      );
    } catch (error) {
      console.error("Lỗi xóa toàn bộ:", error);

      setMessage(
        error.response?.data?.message ||
          "Không xóa được toàn bộ dữ liệu. Vui lòng thử lại."
      );
    } finally {
      setClearingAll(false);
    }
  };

  const searchSavedRows = () => {
    if (
      searchForm.fromDate &&
      searchForm.toDate &&
      searchForm.fromDate.getTime() > searchForm.toDate.getTime()
    ) {
      setMessage("Từ ngày không được lớn hơn Đến ngày.");
      return;
    }

    loadSavedRows(searchForm);
  };

  const resetSavedRowSearch = () => {
    const emptyForm = {
      code: "",
      name: "",
      fromDate: null,
      toDate: null,
      address: "",
      objectType: "",
      occupation: "",
    };

    setSearchForm(emptyForm);
    setMessage("");
    loadSavedRows(emptyForm);
  };

  const clearPreview = (showMessage = true) => {
    setRows([]);
    setFileName("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (showMessage) {
      setMessage("Đã xóa dữ liệu xem trước.");
    }
  };

  const validCount = useMemo(
    () => rows.filter((row) => row.isValid).length,
    [rows]
  );

  const errorCount = rows.length - validCount;

  return (
    <div
      className="container-fluid py-4"
      style={{ background: "#e8eef7", minHeight: "100vh" }}
    >
      <div
        className="card border-0 shadow"
        style={{ borderRadius: "16px", overflow: "hidden" }}
      >
        <div
          className="card-header text-white d-flex justify-content-between align-items-center"
          style={{ background: "#1d4ed8", padding: "18px 22px" }}
        >
          <div>
            <h4 className="mb-1 fw-bold">
              IMPORT DANH SÁCH KHÁM SỨC KHỎE
            </h4>
            <small>Kiểm tra dữ liệu và chống trùng Căn cước</small>
          </div>

          <button
            type="button"
            className="btn btn-light fw-semibold px-4"
            onClick={downloadTemplate}
          >
            Tải file mẫu
          </button>
        </div>

        <div className="card-body p-4">
          {message && (
            <div
              className="alert alert-info shadow-sm"
              style={{ whiteSpace: "pre-line" }}
            >
              {message}
            </div>
          )}

          <div className="card border-0 shadow-sm mb-4">
            <div className="card-body">
              <div className="row g-3 align-items-end">
                <div className="col-lg-7">
                  <label className="form-label fw-semibold">
                    Chọn file Excel
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    className="form-control"
                    accept=".xlsx,.xls"
                    onChange={handleFile}
                  />
                </div>

                <div className="col-lg-5">
                  <div className="d-flex gap-2 justify-content-lg-end">
                    <button
                      type="button"
                      className="btn btn-success px-4"
                      disabled={rows.length === 0 || loading}
                      onClick={saveToDb}
                    >
                      {loading ? "Đang lưu..." : "Lưu vào hệ thống"}
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={rows.length === 0}
                      onClick={() => clearPreview(true)}
                    >
                      Xóa xem trước
                    </button>
                  </div>
                </div>
              </div>

              {fileName && (
                <div className="mt-3 text-muted">
                  File đang đọc: <b>{fileName}</b>
                </div>
              )}
            </div>
          </div>

          {rows.length > 0 && (
            <>
              <div className="row g-3 mb-3">
                <div className="col-md-4">
                  <div className="alert alert-primary mb-0">
                    <b>Tổng số dòng:</b> {rows.length}
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="alert alert-success mb-0">
                    <b>Hợp lệ:</b> {validCount}
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="alert alert-danger mb-0">
                    <b>Có lỗi:</b> {errorCount}
                  </div>
                </div>
              </div>

              <div className="card border-0 shadow-sm mb-4">
                <div className="card-header bg-primary text-white fw-semibold">
                  Dữ liệu xem trước
                </div>

                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-center">
                      <tr>
                        <th>STT</th>
                        <th>Dòng Excel</th>
                        <th>Căn cước</th>
                        <th>Họ và tên</th>
                        <th>Đối tượng</th>
                        <th>Số điện thoại</th>
                        <th>Năm sinh</th>
                        <th>Ngày khám</th>
                        <th>Địa chỉ</th>
                        <th>Nghề nghiệp</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((row, index) => (
                        <tr
                          key={`${row.excelLine}-${row.code}-${index}`}
                          className={
                            row.isValid ? "table-success" : "table-danger"
                          }
                        >
                          <td className="text-center">{row.displayStt}</td>
                          <td className="text-center">{row.excelLine}</td>
                          <td className="text-center fw-semibold">{row.code}</td>
                          <td className="fw-semibold">{row.name}</td>
                          <td className="text-center">{row.objectType}</td>
                          <td className="text-center">{row.phoneNumber}</td>
                          <td className="text-center">{row.taxCode}</td>
                          <td className="text-center">
                            {formatDateVN(row.examinationDate)}
                          </td>
                          <td>{row.address}</td>
                          <td>{row.occupation}</td>
                          <td>
                            {row.isValid ? (
                              <span className="badge bg-success">Hợp lệ</span>
                            ) : (
                              <span className="text-danger fw-semibold">
                                {row.errors.join("; ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          <div className="card border-0 shadow-sm">
            <div className="card-header bg-dark text-white d-flex flex-wrap gap-2 justify-content-between align-items-center">
              <div>
                <span className="fw-semibold">Danh sách đã lưu</span>
                <span className="ms-3">{savedRows.length} khám sức khỏe</span>
              </div>

              <button
                type="button"
                className="btn btn-danger btn-sm"
                disabled={savedRows.length === 0 || clearingAll}
                onClick={clearAllSavedRows}
              >
                {clearingAll ? "Đang xóa..." : "Xóa theo điều kiện tìm kiếm"}
              </button>
            </div>

            <div className="card-body border-bottom bg-light">
              <div className="row g-3">
                <div className="col-lg-2 col-md-6">
                  <label className="form-label fw-semibold">Căn cước</label>
                  <input
                    type="text"
                    className="form-control"
                    value={searchForm.code}
                    onChange={(event) => setSearchForm((current) => ({
                      ...current,
                      code: event.target.value,
                    }))}
                    placeholder="Nhập số căn cước"
                  />
                </div>

                <div className="col-lg-2 col-md-6">
                  <label className="form-label fw-semibold">Họ và tên</label>
                  <input
                    type="text"
                    className="form-control"
                    value={searchForm.name}
                    onChange={(event) => setSearchForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))}
                    placeholder="Nhập họ và tên"
                  />
                </div>

                <div className="col-lg-2 col-md-6">
                  <label className="form-label fw-semibold d-block">Từ ngày</label>
                  <DatePicker
                    wrapperClassName="w-100"
                    selected={searchForm.fromDate}
                    onChange={(date) => setSearchForm((current) => ({
                      ...current,
                      fromDate: date,
                    }))}
                    dateFormat="dd/MM/yyyy"
                    className="form-control"
                    placeholderText="dd/MM/yyyy"
                    isClearable
                  />
                </div>

                <div className="col-lg-2 col-md-6">
                  <label className="form-label fw-semibold">Đối tượng</label>
                  <input
                    type="text"
                    className="form-control"
                    value={searchForm.objectType}
                    onChange={(event) => setSearchForm((current) => ({
                      ...current,
                      objectType: event.target.value,
                    }))}
                    placeholder="Nhập đối tượng"
                  />
                </div>

                <div className="col-lg-2 col-md-6">
                  <label className="form-label fw-semibold d-block">Đến ngày</label>
                  <DatePicker
                    wrapperClassName="w-100"
                    selected={searchForm.toDate}
                    onChange={(date) => setSearchForm((current) => ({
                      ...current,
                      toDate: date,
                    }))}
                    dateFormat="dd/MM/yyyy"
                    className="form-control"
                    placeholderText="dd/MM/yyyy"
                    isClearable
                  />
                </div>

                <div className="col-lg-2 col-md-12">
                  <label className="form-label fw-semibold">Địa chỉ</label>
                  <input
                    type="text"
                    className="form-control"
                    value={searchForm.address}
                    onChange={(event) => setSearchForm((current) => ({
                      ...current,
                      address: event.target.value,
                    }))}
                    placeholder="Nhập địa chỉ"
                  />
                </div>

                <div className="col-lg-2 col-md-12">
                  <label className="form-label fw-semibold">Nghề nghiệp</label>
                  <input
                    type="text"
                    className="form-control"
                    value={searchForm.occupation}
                    onChange={(event) => setSearchForm((current) => ({
                      ...current,
                      occupation: event.target.value,
                    }))}
                    placeholder="Nhập nghề nghiệp"
                  />
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button type="button" className="btn btn-primary" onClick={searchSavedRows} disabled={clearingAll}>
                  Tìm kiếm
                </button>
                <button type="button" className="btn btn-outline-secondary" onClick={resetSavedRowSearch} disabled={clearingAll}>
                  Làm mới
                </button>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-secondary text-center">
                  <tr>
                    <th>STT</th>
                    <th>Căn cước</th>
                    <th>Họ và tên</th>
                    <th>Đối tượng</th>
                    <th>Số điện thoại</th>
                    <th>Năm sinh</th>
                    <th>Ngày khám</th>
                    <th>Địa chỉ</th>
                    <th>Nghề nghiệp</th>
                    <th style={{ width: "100px" }}>Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {savedRows.map((row, index) => (
                    <tr key={row.id}>
                      <td className="text-center">{index + 1}</td>
                      <td className="text-center fw-semibold text-primary">
                        {row.code}
                      </td>
                      <td className="fw-semibold">{row.name}</td>
                      <td className="text-center">{row.objectType}</td>
                      <td className="text-center">{row.phoneNumber}</td>
                      <td className="text-center">{row.taxCode}</td>
                      <td className="text-center text-success fw-semibold">
                        {formatDateVN(row.examinationDate)}
                      </td>
                      <td>{row.address}</td>
                      <td>{row.occupation}</td>
                      <td className="text-center">
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          disabled={deletingId === row.id || clearingAll}
                          onClick={() => deleteOne(row)}
                        >
                          {deletingId === row.id ? "..." : "Xóa"}
                        </button>
                      </td>
                    </tr>
                  ))}

                  {savedRows.length === 0 && (
                    <tr>
                      <td colSpan="10" className="text-center text-muted py-4">
                        Chưa có dữ liệu khám sức khỏe
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ImportDataPage;
