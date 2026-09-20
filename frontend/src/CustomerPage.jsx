import DatePicker from "react-datepicker";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import api from "./api";
import TablePagination from "./TablePagination";
import HealthSummaryCards from "./HealthSummaryCards";
import { useNotification } from "./NotificationProvider";

const createEmptyForm = () => ({
  code: "",
  name: "",
  objectType: "",
  phoneNumber: "",
  address: "",
  taxCode: "",
  occupation: "",
  hamlet: "",
  group: "",
  examinationPlace: "",
  citizenIdIssueDate: null,
  birthDate: null,
  examinationDate: new Date(),
  examinationSequenceNumber: "",
});

const toApiDate = (value) => {
  if (!value) return null;

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const normalizeSearchText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLocaleLowerCase("vi-VN")
    .trim();

const parseDateOnly = (value) => {
  const [year, month, day] = String(value ?? "")
    .substring(0, 10)
    .split("-")
    .map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
};

const normalizeHamlet = (value) =>
  normalizeSearchText(value)
    .replace(/\([^)]*\)/g, " ")
    .replace(/^[\s.:;-]*ap\s+/, "")
    .replace(/[\s.:;-]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

const getHamletFromAddress = (address, hamlets) => {
  const parts = String(address ?? "")
    .split(/[,;]/)
    .map(normalizeHamlet)
    .filter(Boolean);
  const normalizedHamlets = hamlets
    .map((hamlet) => ({
      name: hamlet.name,
      normalizedName: normalizeHamlet(hamlet.name),
    }))
    .filter((hamlet) => hamlet.normalizedName);

  const exactMatch = normalizedHamlets.find((hamlet) =>
    parts.some((part) => part === hamlet.normalizedName)
  );

  if (exactMatch) return exactMatch.name;

  return normalizedHamlets
    .filter((hamlet) =>
      parts.some(
        (part) =>
          part.startsWith(`${hamlet.normalizedName} `) ||
          part.endsWith(` ${hamlet.normalizedName}`)
      )
    )
    .sort(
      (first, second) =>
        second.normalizedName.length - first.normalizedName.length
    )[0]?.name ?? "Chưa xác định";
};



function ExaminationNumberInput({ customer, disabled, onSave }) {
  const [value, setValue] = useState(customer.examinationSequenceNumber ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="d-inline-flex align-items-center gap-1 ms-2"
      title="STT khám"
      onSubmit={async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (saving) return;
        setSaving(true);
        try { await onSave(customer.id, value === "" ? null : Number(value)); }
        finally { setSaving(false); }
      }}
    >
      <input id={`examination-number-${customer.id}`} type="number" min="1" max="2147483647" step="1"
        className="form-control form-control-sm d-inline-block" style={{ width: 58, padding: "1px 4px", fontSize: "12px" }}
        value={value} onChange={(event) => setValue(event.target.value)} disabled={disabled || saving} />
      <button type="submit" className="btn btn-outline-primary btn-sm px-1 py-0" style={{ fontSize: "12px" }}
        title="Lưu STT khám" disabled={disabled || saving}>
        {saving ? "..." : "Lưu"}
      </button>
    </form>
  );
}

function CustomerPage() {
  const { notify, confirm } = useNotification();

  const [customers, setCustomers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(createEmptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [checkingCode, setCheckingCode] = useState(false);

  const [searchText, setSearchText] = useState("");
  const deferredSearchText = useDeferredValue(searchText);

  const [requestedPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [catalogOptions, setCatalogOptions] = useState({
    objectType: [],
    occupation: [],
    hamlet: [],
    group: [],
    examinationPlace: [],
  });

  const codeInputRef = useRef(null);

  const searchableCustomers = useMemo(
    () =>
      customers.map((customer) => ({
        customer,
        searchIndex: normalizeSearchText(
          [
            customer.code,
            customer.name,
            customer.objectType,
            customer.phoneNumber,
            customer.taxCode,
            customer.address,
            customer.occupation,
          ].join(" ")
        ),
      })),
    [customers]
  );

  const filteredCustomers = useMemo(() => {
    const keyword = normalizeSearchText(deferredSearchText);

    const matchingCustomers = keyword
      ? searchableCustomers
          .filter(({ searchIndex }) => searchIndex.includes(keyword))
          .map(({ customer }) => customer)
      : customers;

    return [...matchingCustomers].sort((first, second) => {
      const dateOrder = String(second.examinationDate ?? "").slice(0, 10)
        .localeCompare(String(first.examinationDate ?? "").slice(0, 10));
      if (dateOrder) return dateOrder;
      const numberOrder = (second.examinationSequenceNumber ?? 0)
        - (first.examinationSequenceNumber ?? 0);
      return numberOrder || String(first.name ?? "").localeCompare(String(second.name ?? ""), "vi")
        || first.id - second.id;
    });
  }, [customers, deferredSearchText, searchableCustomers]);

  const todayDate = toApiDate(new Date());

  const todayExaminations = useMemo(
    () =>
      customers.filter(
        (customer) =>
          String(customer.examinationDate ?? "").substring(0, 10) ===
          todayDate
      ),
    [customers, todayDate]
  );

  const todayExaminationCount = todayExaminations.length;

  const todayUnder18Count = useMemo(
    () =>
      todayExaminations.filter((customer) => {
        if (!customer.birthDate) return false;

        const birthDate = parseDateOnly(customer.birthDate);
        const examinationDate = parseDateOnly(customer.examinationDate);

        if (!birthDate || !examinationDate) {
          return false;
        }

        const eighteenthBirthday = new Date(birthDate);
        eighteenthBirthday.setFullYear(
          eighteenthBirthday.getFullYear() + 18
        );

        return eighteenthBirthday > examinationDate;
      }).length,
    [todayExaminations]
  );

  const todayElderlyCount = useMemo(
    () =>
      todayExaminations.filter(
        (customer) =>
          normalizeSearchText(customer.objectType) ===
          normalizeSearchText("NGƯỜI CAO TUỔI")
      ).length,
    [todayExaminations]
  );

  const todayHamletSummary = useMemo(() => {
    const summary = new Map();

    todayExaminations.forEach((customer) => {
      const hamletName = getHamletFromAddress(
        customer.address,
        catalogOptions.hamlet
      );
      const current = summary.get(hamletName) ?? {
        total: 0,
        under18: 0,
        elderly: 0,
      };

      current.total += 1;

      const birthDate = parseDateOnly(customer.birthDate);
      const examinationDate = parseDateOnly(customer.examinationDate);

      if (birthDate && examinationDate) {
        const eighteenthBirthday = new Date(birthDate);
        eighteenthBirthday.setFullYear(
          eighteenthBirthday.getFullYear() + 18
        );

        if (eighteenthBirthday > examinationDate) {
          current.under18 += 1;
        }
      }

      if (
        normalizeSearchText(customer.objectType) ===
        normalizeSearchText("NGƯỜI CAO TUỔI")
      ) {
        current.elderly += 1;
      }

      summary.set(hamletName, current);
    });

    return [...summary.entries()].sort((first, second) =>
      first[0].localeCompare(second[0], "vi")
    );
  }, [catalogOptions.hamlet, todayExaminations]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / pageSize)
  );

  const currentPage = Math.min(requestedPage, totalPages);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;

    return filteredCustomers.slice(
      startIndex,
      startIndex + pageSize
    );
  }, [currentPage, filteredCustomers, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText]);

  const focusFirstInput = () => {
    requestAnimationFrame(() => codeInputRef.current?.focus());
  };

  const loadCustomers = async () => {
    try {
      const res = await api.get("/Customers");

      setCustomers(
        Array.isArray(res.data) ? res.data : []
      );
    } catch (error) {
      console.error(
        "Lỗi tải danh sách khám sức khỏe:",
        error
      );

      notify(
        "Không thể tải danh sách khám sức khỏe.",
        "error"
      );
    }
  };

  const loadCatalogOptions = async () => {
    try {
      const [
        objectType,
        occupation,
        hamlet,
        group,
        examinationPlace,
      ] = await Promise.all(
        [
          "objectType",
          "occupation",
          "hamlet",
          "group",
          "examinationPlace",
        ].map((category) =>
          api.get("/CatalogItems", {
            params: { category },
          })
        )
      );

      const objectTypeOptions = Array.isArray(
        objectType.data
      )
        ? objectType.data
        : [];

      const occupationOptions = Array.isArray(
        occupation.data
      )
        ? occupation.data
        : [];

      const hamletOptions = Array.isArray(
        hamlet.data
      )
        ? hamlet.data
        : [];

      const groupOptions = Array.isArray(group.data)
        ? group.data
        : [];

      const examinationPlaceOptions = Array.isArray(examinationPlace.data)
        ? examinationPlace.data
        : [];

      setCatalogOptions({
        objectType: objectTypeOptions,
        occupation: occupationOptions,
        hamlet: hamletOptions,
        group: groupOptions,
        examinationPlace: examinationPlaceOptions,
      });

      // =====================================================
      // TỰ ĐỘNG CHỌN GIÁ TRỊ MẶC ĐỊNH
      // - Đối tượng: item.isDefault = true
      // - Ấp:       item.isDefault = true
      // =====================================================
      setForm((current) => ({
        ...current,

        objectType:
          current.objectType ||
          objectTypeOptions.find(
            (item) => item.isDefault
          )?.name ||
          "",

        hamlet:
          current.hamlet ||
          hamletOptions.find(
            (item) => item.isDefault
          )?.name ||
          "",

        examinationPlace:
          current.examinationPlace ||
          examinationPlaceOptions.find(
            (item) => item.isDefault
          )?.name ||
          "",
      }));
    } catch (error) {
      console.error(
        "Không tải được danh mục:",
        error
      );
    }
  };

  useEffect(() => {
    loadCustomers();
    loadCatalogOptions();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prevForm) => ({
      ...prevForm,
      [name]: value,
    }));
  };

  // =====================================================
  // KIỂM TRA TRÙNG CĂN CƯỚC NGAY KHI RỜI Ô (TAB/BLUR)
  // =====================================================
  const handleCodeBlur = async () => {
    const code = (form.code ?? "").trim();

    if (!code) return;

    setCheckingCode(true);

    try {
      const res = await api.get("/Customers/check-code", {
        params: {
          code,
          exceptId: editingId ?? undefined,
        },
      });

      if (res.data?.duplicated && res.data?.duplicatedCustomer) {
        setDuplicateInfo(res.data.duplicatedCustomer);
      }
    } catch (error) {
      console.error("Lỗi kiểm tra căn cước:", error);
    } finally {
      setCheckingCode(false);
    }
  };

  // =====================================================
  // TỰ ĐỘNG ĐỔI ĐỐI TƯỢNG KHI NHẬP NĂM SINH
  // CHỈ ÁP DỤNG KHI THÊM MỚI
  // =====================================================
  const getAgeInYears = (birthDate, examinationDate) => {
    if (!(birthDate instanceof Date) || Number.isNaN(birthDate.getTime()) || !(examinationDate instanceof Date) || Number.isNaN(examinationDate.getTime())) {
      return null;
    }

    const birth = new Date(birthDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
    const examination = new Date(examinationDate.getFullYear(), examinationDate.getMonth(), examinationDate.getDate());

    if (birth > examination) {
      return null;
    }

    let age = examination.getFullYear() - birth.getFullYear();

    if (
      examination.getMonth() < birth.getMonth() ||
      (examination.getMonth() === birth.getMonth() && examination.getDate() < birth.getDate())
    ) {
      age -= 1;
    }

    return age;
  };

  const getAutoObjectType = (birthDate, examinationDate, birthYear) => {
    const resolvedBirthDate = birthDate instanceof Date && !Number.isNaN(birthDate.getTime())
      ? birthDate
      : (birthYear && Number.isFinite(Number(birthYear)) ? new Date(Number(birthYear), 0, 1) : null);

    const resolvedExaminationDate = examinationDate instanceof Date && !Number.isNaN(examinationDate.getTime())
      ? examinationDate
      : null;

    if (!resolvedBirthDate || !resolvedExaminationDate) {
      return null;
    }

    const age = getAgeInYears(resolvedBirthDate, resolvedExaminationDate);

    if (age === null) {
      return null;
    }

    if (age >= 60) {
      return "NGƯỜI CAO TUỔI";
    }

    if (age < 18) {
      return "DƯỚI 18";
    }

    return null;
  };

  const handleBirthYearBlur = () => {
    setForm((prevForm) => {
      if (editingId !== null) {
        return prevForm;
      }

      const autoObjectType = getAutoObjectType(
        prevForm.birthDate,
        prevForm.examinationDate,
        prevForm.taxCode
      );

      if (!autoObjectType) {
        return prevForm;
      }

      return {
        ...prevForm,
        objectType: autoObjectType,
      };
    });
  };

  const handleBirthDateChange = (date) => {
    setForm((prevForm) => {
      const nextForm = {
        ...prevForm,
        birthDate: date,
        taxCode: date
          ? String(date.getFullYear())
          : prevForm.taxCode,
      };

      if (editingId !== null) {
        return nextForm;
      }

      const autoObjectType = getAutoObjectType(nextForm.birthDate, nextForm.examinationDate, nextForm.taxCode);
      return autoObjectType ? { ...nextForm, objectType: autoObjectType } : nextForm;
    });
  };

  const handleBirthDateRawChange = (event) => {
    const rawValue =
      event?.target?.value ?? "";

    const digits = rawValue.replace(/\D/g, "");

    if (
      digits.length !== 8 ||
      rawValue !== digits
    ) {
      return;
    }

    const day = Number(
      digits.slice(0, 2)
    );

    const month = Number(
      digits.slice(2, 4)
    );

    const year = Number(
      digits.slice(4, 8)
    );

    const date = new Date(
      year,
      month - 1,
      day
    );

    const isValidDate =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date <= new Date();

    if (isValidDate) {
      event.preventDefault();

      handleBirthDateChange(date);
    }
  };

  const formatLocationPart = (
    prefix,
    value
  ) => {
    const name = value.trim();

    if (!name) return "";

    return name
      .toLocaleLowerCase("vi-VN")
      .startsWith(prefix)
      ? name
      : `${prefix} ${name}`;
  };

  const handleLocationChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((prevForm) => {
      const nextForm = {
        ...prevForm,
        [name]: value,
      };

      const location = [
        formatLocationPart(
          "tổ",
          nextForm.group
        ),
        formatLocationPart(
          "ấp",
          nextForm.hamlet
        ),
      ]
        .filter(Boolean)
        .join(", ");

      return {
        ...nextForm,
        address: location,
      };
    });
  };

  const getLocationSelection = (
    address,
    prefix,
    options
  ) => {
    const locationParts = String(
      address ?? ""
    )
      .split(",")
      .map((part) =>
        part
          .trim()
          .toLocaleLowerCase("vi-VN")
      );

    return (
      options.find((item) =>
        locationParts.includes(
          formatLocationPart(
            prefix,
            item.name
          ).toLocaleLowerCase("vi-VN")
        )
      )?.name ?? ""
    );
  };

  // =====================================================
  // RESET FORM
  // ĐỐI TƯỢNG + ẤP ĐỀU LẤY isDefault
  // =====================================================
  const resetForm = () => {
    setEditingId(null);

    setForm({
      ...createEmptyForm(),

      // Mặc định Đối tượng
      objectType:
        catalogOptions.objectType.find(
          (item) => item.isDefault
        )?.name ?? "",

      // Mặc định Ấp
      hamlet:
        catalogOptions.hamlet.find(
          (item) => item.isDefault
        )?.name ?? "",

      // Mặc định Nơi khám
      examinationPlace:
        catalogOptions.examinationPlace.find(
          (item) => item.isDefault
        )?.name ?? "",
    });

    focusFirstInput();
  };

  const getApiErrorMessage = (error) => {
    const errors =
      error?.response?.data?.errors;

    if (
      errors &&
      typeof errors === "object"
    ) {
      return Object.values(errors)
        .flat()
        .join("\n");
    }

    return (
      error?.response?.data?.title ||
      error?.response?.data?.message ||
      "Không thể lưu thông tin khám sức khỏe."
    );
  };

  const saveExaminationNumber = async (id, examinationSequenceNumber) => {
    try {
      const { data } = await api.patch(`/Customers/${id}/examination-number`, { examinationSequenceNumber });
      setCustomers((current) => current.map((customer) => customer.id === id
        ? { ...customer, examinationSequenceNumber: data.examinationSequenceNumber } : customer));
      if (editingId === id) {
        setForm((current) => ({ ...current, examinationSequenceNumber: data.examinationSequenceNumber ?? "" }));
      }
      notify("Đã lưu STT khám.", "success");
    } catch (error) {
      notify(getApiErrorMessage(error), "error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      examinationSequenceNumber: form.examinationSequenceNumber === "" ? null : Number(form.examinationSequenceNumber),

      code: form.code.trim(),
      name: form.name.trim(),
      objectType: form.objectType.trim(),
      phoneNumber: form.phoneNumber.trim(),
      address: form.address.trim(),
      taxCode: form.taxCode.trim(),
      occupation: form.occupation.trim(),
      examinationPlace: form.examinationPlace.trim(),

      citizenIdIssueDate: toApiDate(
        form.citizenIdIssueDate
      ),

      birthDate: toApiDate(
        form.birthDate
      ),

      examinationDate:
        toApiDate(
          form.examinationDate
        ),
    };

    if (
      !payload.code ||
      !payload.name ||
      !payload.taxCode ||
      !payload.examinationDate
    ) {
      notify(
        "Vui lòng nhập đủ Căn cước, Họ và tên, Năm sinh và Ngày khám.",
        "warning"
      );

      return;
    }

    try {
      setIsSaving(true);

      if (editingId !== null) {
        console.log(
          "Cập nhật hồ sơ khám sức khỏe:",
          {
            editingId,
            formObjectType:
              form.objectType,
            payloadObjectType:
              payload.objectType,
            formHamlet:
              form.hamlet,
            payloadHamlet:
              payload.hamlet,
          }
        );

        await api.put(
          `/Customers/${editingId}`,
          payload
        );
      } else {
        await api.post(
          "/Customers",
          payload
        );
      }

      resetForm();

      await loadCustomers();
    } catch (error) {
      console.error(
        "Lỗi lưu thông tin khám sức khỏe:",
        error
      );

      // Trùng căn cước: hiện modal nổi bật thông tin bản ghi đã tồn tại.
      const duplicatedCustomer =
        error?.response?.data?.duplicatedCustomer;

      if (duplicatedCustomer) {
        setDuplicateInfo(duplicatedCustomer);
        return;
      }

      notify(
        getApiErrorMessage(error),
        "error"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const editCustomer = (customer) => {
    setEditingId(customer.id);

    setForm({
      examinationSequenceNumber: customer.examinationSequenceNumber ?? "",
      code: customer.code ?? "",
      name: customer.name ?? "",
      objectType:
        customer.objectType ?? "",
      phoneNumber:
        customer.phoneNumber ?? "",
      address:
        customer.address ?? "",
      taxCode:
        customer.taxCode ?? "",
      occupation:
        customer.occupation ?? "",

      // Khi sửa: lấy đúng Ấp của hồ sơ
      hamlet: getLocationSelection(
        customer.address,
        "ấp",
        catalogOptions.hamlet
      ),

      group: getLocationSelection(
        customer.address,
        "tổ",
        catalogOptions.group
      ),

      // Giữ lại Nơi khám và Ngày cấp CCCD của hồ sơ khi cập nhật
      examinationPlace:
        customer.examinationPlace ?? "",

      citizenIdIssueDate:
        customer.citizenIdIssueDate
          ? new Date(
              customer.citizenIdIssueDate
            )
          : null,

      birthDate:
        customer.birthDate
          ? new Date(
              customer.birthDate
            )
          : null,

      examinationDate:
        customer.examinationDate
          ? new Date(
              customer.examinationDate
            )
          : null,
    });

    focusFirstInput();

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleFormKeyDown = (event) => {
    if (
      event.key !== "Enter" ||
      event.isComposing ||
      event.target.tagName ===
        "BUTTON" ||
      isSaving
    ) {
      return;
    }

    event.preventDefault();

    event.currentTarget.requestSubmit();
  };

  const deleteCustomer = async (id) => {
    const confirmed =
      await confirm({
        title:
          "Xóa hồ sơ khám sức khỏe?",
        message:
          "Dữ liệu đã xóa sẽ không thể khôi phục.",
        confirmText:
          "Xóa hồ sơ",
      });

    if (!confirmed) return;

    try {
      setDeletingId(id);

      await api.delete(
        `/Customers/${id}`
      );

      await loadCustomers();

      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      console.error(
        "Lỗi xóa khám sức khỏe:",
        error
      );

      notify(
        "Không thể xóa khám sức khỏe.",
        "error"
      );
    } finally {
      setDeletingId(null);
      focusFirstInput();
    }
  };

  const formatExaminationDate = (
    value
  ) => {
    if (!value) return "";

    const dateOnly =
      value.substring(0, 10);

    const [
      year,
      month,
      day,
    ] = dateOnly.split("-");

    if (
      !year ||
      !month ||
      !day
    ) {
      return value;
    }

    return `${day}/${month}/${year}`;
  };

  return (
    <div
      className="container-fluid py-4"
      style={{
        background: "#e8eef7",
        minHeight: "100vh",
      }}
    >
      <div
        className="card border-0 shadow"
        style={{
          borderRadius: "16px",
          background: "#f3f6fb",
        }}
      >
        <div
          className="card-header text-center border-0"
          style={{
            background: "#0f766e",
            color: "white",
            borderTopLeftRadius:
              "16px",
            borderTopRightRadius:
              "16px",
            padding: "18px",
          }}
        >
          <h4 className="fw-bold mb-1 text-uppercase">
            DANH SÁCH KHÁM SỨC KHỎE
          </h4>

          <div>
            Quản lý thông tin khám sức khỏe
          </div>
        </div>

        <div className="card-body p-4">
          <form
            onSubmit={handleSubmit}
            onKeyDown={
              handleFormKeyDown
            }
            className="mb-4"
          >
            <div className="row g-3">

             

              {/* CĂN CƯỚC */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Căn cước{" "}
                  <span className="text-danger">
                    *
                  </span>
                </label>

                <input
                  ref={codeInputRef}
                  type="text"
                  name="code"
                  className="form-control"
                  value={form.code}
                  onChange={
                    handleChange
                  }
                  onBlur={handleCodeBlur}
                  placeholder={
                    checkingCode
                      ? "Đang kiểm tra..."
                      : "Nhập số căn cước"
                  }
                  required
                />
              </div>

              {/* HỌ TÊN */}
              <div className="col-md-5">
                <label className="form-label fw-semibold">
                  Họ và tên{" "}
                  <span className="text-danger">
                    *
                  </span>
                </label>

                <input
                  type="text"
                  name="name"
                  className="form-control"
                  value={form.name}
                  onChange={
                    handleChange
                  }
                  placeholder="Nhập họ và tên"
                  required
                />
              </div>

              {/* NGÀY SINH */}
              <div className="col-md-2">
                <label className="form-label fw-semibold">
                  Ngày sinh
                </label>

                <DatePicker
                  wrapperClassName="w-100"
                  selected={
                    form.birthDate
                  }
                  onChange={
                    handleBirthDateChange
                  }
                  onChangeRaw={
                    handleBirthDateRawChange
                  }
                  dateFormat="dd/MM/yyyy"
                  className="form-control"
                  placeholderText="dd/MM/yyyy"
                  maxDate={
                    new Date()
                  }
                  isClearable
                />
              </div>

              {/* NĂM SINH */}
              <div className="col-md-2">
                <label className="form-label fw-semibold">
                  Năm sinh{" "}
                  <span className="text-danger">
                    *
                  </span>
                </label>

                <input
                  type="number"
                  name="taxCode"
                  className="form-control"
                  value={
                    form.taxCode
                  }
                  onChange={
                    handleChange
                  }
                  onBlur={
                    handleBirthYearBlur
                  }
                  placeholder="Ví dụ: 1995"
                  min="1900"
                  max={
                    new Date().getFullYear()
                  }
                  required
                />
              </div>

              {/* TỔ */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Tổ
                </label>

                <input
                  name="group"
                  className="form-control"
                  value={
                    form.group ?? ""
                  }
                  onChange={
                    handleLocationChange
                  }
                  list="customer-group-options"
                  placeholder="Gõ để tìm tổ"
                >
                </input>
                <datalist id="customer-group-options">
                  {catalogOptions.group.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </div>

              {/* ẤP - CÓ MẶC ĐỊNH */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Ấp
                </label>

                <input
                  name="hamlet"
                  className="form-control"
                  value={
                    form.hamlet ?? ""
                  }
                  onChange={
                    handleLocationChange
                  }
                  list="customer-hamlet-options"
                  placeholder="Gõ để tìm ấp"
                >
                </input>
                <datalist id="customer-hamlet-options">
                  {catalogOptions.hamlet.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </div>

              {/* ĐỊA CHỈ */}
              <div className="col-md-6">
                <label className="form-label fw-semibold">
                  Địa chỉ
                </label>

                <input
                  name="address"
                  type="text"
                  className="form-control"
                  value={
                    form.address ?? ""
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Nhập địa chỉ"
                />
              </div>
              {/* SỐ ĐIỆN THOẠI */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Số điện thoại
                </label>

                <input
                  type="tel"
                  name="phoneNumber"
                  className="form-control"
                  value={form.phoneNumber}
                  onChange={handleChange}
                  placeholder="Nhập số điện thoại"
                />
              </div>
              {/* NGÀY KHÁM */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Ngày khám{" "}
                  <span className="text-danger">
                    *
                  </span>
                </label>

                <DatePicker
                  wrapperClassName="w-100"
                  selected={
                    form.examinationDate
                  }
                  onChange={(date) =>
                    setForm((prevForm) => {
                      const nextForm = {
                        ...prevForm,
                        examinationDate: date,
                      };

                      if (editingId !== null) {
                        return nextForm;
                      }

                      const autoObjectType = getAutoObjectType(nextForm.birthDate, nextForm.examinationDate, nextForm.taxCode);
                      return autoObjectType ? { ...nextForm, objectType: autoObjectType } : nextForm;
                    })
                  }
                  dateFormat="dd/MM/yyyy"
                  className="form-control"
                  placeholderText="dd/MM/yyyy"
                  required
                />
              </div>

              {/* ĐỐI TƯỢNG */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Đối tượng
                </label>

                <input
                  name="objectType"
                  className="form-control"
                  value={
                    form.objectType ??
                    ""
                  }
                  onChange={
                    handleChange
                  }
                  list="customer-object-type-options"
                  placeholder="Gõ để tìm đối tượng"
                >
                </input>
                <datalist id="customer-object-type-options">
                  {catalogOptions.objectType.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </div>

              {/* NGHỀ NGHIỆP */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Nghề nghiệp
                </label>

                <input
                  name="occupation"
                  className="form-control"
                  value={
                    form.occupation ??
                    ""
                  }
                  onChange={
                    handleChange
                  }
                  list="customer-occupation-options"
                  placeholder="Gõ để tìm nghề nghiệp"
                >
                </input>
                <datalist id="customer-occupation-options">
                  {catalogOptions.occupation.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </div>

              {/* NƠI KHÁM */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Nơi khám
                </label>

                <input
                  name="examinationPlace"
                  className="form-control"
                  value={form.examinationPlace ?? ""}
                  onChange={handleChange}
                  list="customer-examination-place-options"
                  placeholder="Gõ để tìm nơi khám"
                />
                <datalist id="customer-examination-place-options">
                  {catalogOptions.examinationPlace.map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </div>

              {/* NGÀY CẤP CCCD */}
              <div className="col-md-3">
                <label className="form-label fw-semibold">
                  Ngày cấp CCCD
                </label>

                <DatePicker
                  wrapperClassName="w-100"
                  selected={form.citizenIdIssueDate}
                  onChange={(date) =>
                    setForm((prevForm) => ({
                      ...prevForm,
                      citizenIdIssueDate: date,
                    }))
                  }
                  dateFormat="dd/MM/yyyy"
                  className="form-control"
                  placeholderText="dd/MM/yyyy"
                  maxDate={new Date()}
                  isClearable
                />
              </div>
            </div>

            <div className="mt-4 text-end">
              {editingId !== null && (
                <button
                  type="button"
                  className="btn btn-outline-secondary me-2 px-4"
                  onClick={
                    resetForm
                  }
                  disabled={
                    isSaving
                  }
                >
                  Hủy
                </button>
              )}

              <button
                type="submit"
                className="btn btn-success px-4"
                disabled={
                  isSaving
                }
              >
                {isSaving
                  ? "Đang lưu..."
                  : editingId !== null
                  ? "Cập nhật"
                  : "Thêm mới"}
              </button>
            </div>
          </form>

          <div className="health-statistics-page mb-3">
            <HealthSummaryCards
              title="Thống kê hôm nay"
              summary={{
                total: todayExaminationCount,
                under18: todayUnder18Count,
                elderly: todayElderlyCount,
                hamlets: todayHamletSummary.map(([label, counts]) => ({
                  id: catalogOptions.hamlet.find((hamlet) => hamlet.name === label)?.id,
                  label,
                  count: counts.total,
                  under18: counts.under18,
                  elderly: counts.elderly,
                })),
              }}
            />
          </div>

          {/* TÌM KIẾM */}
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-body">
              <div className="row g-2 align-items-center">
                <div className="col-md-9">
                  <input
                    type="search"
                    className="form-control"
                    value={
                      searchText
                    }
                    onChange={(event) =>
                      setSearchText(
                        event.target
                          .value
                      )
                    }
                    placeholder="Tìm theo căn cước, họ tên, đối tượng, năm sinh, địa chỉ hoặc nghề nghiệp"
                    autoComplete="off"
                  />
                </div>

                <div className="col-md-3 d-flex align-items-center justify-content-md-end gap-2">
                  <span className="text-muted">
                    {
                      filteredCustomers.length
                    }
                    /
                    {
                      customers.length
                    }{" "}
                    kết quả
                  </span>

                  {searchText && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() =>
                        setSearchText(
                          ""
                        )
                      }
                    >
                      Xóa lọc
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* BẢNG */}
          <div
            className="table-responsive"
            style={{
              background:
                "#edf2f7",
              padding: "14px",
              borderRadius:
                "14px",
              overflowX:
                "hidden",
              overflowY:
                "hidden",
              paddingBottom:
                "8px",
            }}
          >
            <table
              className="table table-bordered table-hover align-middle mb-0"
              style={{
                width:
                  "100%",
                tableLayout:
                  "fixed",
                fontSize:
                  "14px",
                background:
                  "#f8fafc",
              }}
            >
              <thead>
                <tr
                  className="text-center"
                  style={{
                    background:
                      "#ccfbf1",
                    color:
                      "#134e4a",
                    fontWeight:
                      "bold",
                  }}
                >
                  <th
                    style={{
                      width:
                        "105px",
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    Thao tác
                  </th>

                  <th
                    style={{
                      width:
                        "55px",
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    STT
                  </th>

                  <th
                    style={{
                      width:
                        "120px",
                      whiteSpace:
                        "nowrap",
                    }}
                  >
                    Ngày khám
                  </th>

                  <th>
                    Thông tin người khám
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan="4"
                      className="text-center text-muted py-4"
                    >
                      Không có dữ liệu
                    </td>
                  </tr>
                ) : (
                  paginatedCustomers.map(
                    (
                      customer,
                      index
                    ) => (
                      <tr
                        key={
                          customer.id
                        }
                        style={
                          customer.examinationSequenceNumber
                            ? {
                                background:
                                  "linear-gradient(90deg, #ecfdf5 0%, #f0fdfa 55%, #ffffff 100%)",
                                borderLeft:
                                  "4px solid #10b981",
                                boxShadow:
                                  "inset 0 0 0 1px #a7f3d0",
                              }
                            : {
                                background:
                                  "#ffffff",
                              }
                        }
                      >
                        <td className="text-center">
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm me-2"
                            title="Sửa"
                            onClick={() =>
                              editCustomer(
                                customer
                              )
                            }
                            disabled={
                              isSaving ||
                              deletingId !==
                                null
                            }
                          >
                            ✏️
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm"
                            title="Xóa"
                            onClick={() =>
                              deleteCustomer(
                                customer.id
                              )
                            }
                            disabled={
                              isSaving ||
                              deletingId !==
                                null
                            }
                          >
                            🗑️
                          </button>
                        </td>

                        <td className="text-center">
                          {(currentPage -
                            1) *
                            pageSize +
                            index +
                            1}
                        </td>

                        <td className="text-center">
                          <span
                            title="Ngày khám"
                            style={{
                              display:
                                "inline-flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              gap: "6px",
                              background:
                                "linear-gradient(135deg, #0ea5e9, #0369a1)",
                              color:
                                "#ffffff",
                              fontWeight:
                                700,
                              fontSize:
                                "13px",
                              letterSpacing:
                                "0.3px",
                              padding:
                                "6px 14px",
                              borderRadius:
                                "999px",
                              boxShadow:
                                "0 2px 8px rgba(3,105,161,0.35)",
                            }}
                          >
                            <span/>
                            {formatExaminationDate(
                              customer.examinationDate
                            )}
                          </span>
                        </td>

                        <td>
                          <div className="row row-cols-2 row-cols-md-4 g-1 small text-muted">
                            <div className="col">
                              <span className="fw-semibold text-body">
                                Căn cước:{" "}
                              </span>

                              <span className="fw-bold text-dark">
                                {customer.code || "—"}
                              </span>

                             

                              <ExaminationNumberInput
                                key={`${customer.id}-${customer.examinationSequenceNumber ?? ""}`}
                                customer={customer} disabled={isSaving || deletingId !== null}
                                onSave={saveExaminationNumber}
                              />
                            </div>

                            <div className="col">
                              <span className="fw-semibold text-body">
                                Họ và tên:{" "}
                              </span>

                              <span className="fw-bold text-dark">
                                {customer.name || "—"}
                              </span>
                            </div>

                            <div className="col">
                              <span className="fw-semibold text-body">
                                Ngày sinh:{" "}
                              </span>

                              <span className="fw-bold text-dark">
                                {formatExaminationDate(customer.birthDate) || "—"}
                              </span>
                            </div>

                            <div className="col">
                              <span className="fw-semibold text-body">
                                Đối tượng:{" "}
                              </span>

                              {
                                customer.objectType ||
                                "—"
                              }
                            </div>

                            <div className="col">
                              <span className="fw-semibold text-body">
                                SĐT:{" "}
                              </span>

                              {customer.phoneNumber || "—"}
                            </div>

                            <div className="col">
                              <span className="fw-semibold text-body">
                                Năm sinh:{" "}
                              </span>

                              {
                                customer.taxCode ||
                                "—"
                              }
                            </div>

                            <div className="col">
                              <span className="fw-semibold text-body">
                                Địa chỉ:{" "}
                              </span>

                              {
                                customer.address ||
                                "—"
                              }
                            </div>

                            <div className="col">
                              <span className="fw-semibold text-body">
                                Nghề nghiệp:{" "}
                              </span>

                              {
                                customer.occupation ||
                                "—"
                              }
                            </div>

                            <div className="col">
                              <span className="fw-semibold text-body">
                                Nơi khám:{" "}
                              </span>

                              {
                                customer.examinationPlace ||
                                "—"
                              }
                            </div>

                            <div className="col">
                              <span className="fw-semibold text-body">
                                Ngày cấp CCCD:{" "}
                              </span>

                              {formatExaminationDate(
                                customer.citizenIdIssueDate
                              ) || "—"}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          <TablePagination
            total={filteredCustomers.length}
            page={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          />
        </div>
      </div>

      {duplicateInfo && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
          style={{ zIndex: 12000, background: "rgba(15, 23, 42, 0.55)", backdropFilter: "blur(3px)" }}
          onMouseDown={(event) => event.target === event.currentTarget && setDuplicateInfo(null)}
        >
          <div className="bg-white shadow-lg" style={{ width: "480px", maxWidth: "100%", borderRadius: "18px", overflow: "hidden" }}>
            <div className="p-4 pb-3 d-flex gap-3" style={{ background: "#fef2f2", borderBottom: "1px solid #fecaca" }}>
              <div className="flex-shrink-0 d-flex align-items-center justify-content-center fw-bold" style={{ width: "46px", height: "46px", borderRadius: "14px", background: "#fee2e2", color: "#b91c1c", fontSize: "24px" }}>!</div>
              <div>
                <h5 className="fw-bold mb-1 text-danger">Căn cước đã tồn tại</h5>
                <div className="text-secondary">Thông tin người khám đã có trong hệ thống.</div>
              </div>
            </div>

            <div className="p-4">
              <div className="text-center mb-3 p-3" style={{ background: "#0f766e", color: "white", borderRadius: "14px" }}>
                <div className="text-uppercase fw-semibold" style={{ fontSize: "12px", letterSpacing: "0.5px", opacity: 0.85 }}>Nơi khám</div>
                <div className="fw-bold" style={{ fontSize: "20px" }}>{duplicateInfo.examinationPlace || "—"}</div>
              </div>

              <div className="row g-3">
                <div className="col-12">
                  <div className="text-muted small fw-semibold text-uppercase">Họ và tên</div>
                  <div className="fw-bold fs-5">{duplicateInfo.name || "—"}</div>
                </div>

                <div className="col-6">
                  <div className="text-muted small fw-semibold text-uppercase">Ngày sinh</div>
                  <div className="fw-semibold">{formatExaminationDate(duplicateInfo.birthDate) || "—"}</div>
                </div>

                <div className="col-6">
                  <div className="text-muted small fw-semibold text-uppercase">Căn cước</div>
                  <div className="fw-semibold text-primary">{duplicateInfo.code || "—"}</div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 d-flex justify-content-end" style={{ background: "#f8fafc" }}>
              <button type="button" className="btn btn-primary px-4" onClick={() => setDuplicateInfo(null)}>Đã hiểu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerPage;
