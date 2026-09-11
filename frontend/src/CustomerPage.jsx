import DatePicker from "react-datepicker";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import api from "./api";
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
  birthDate: null,
  examinationDate: new Date(),
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

const PAGE_SIZE = 50;

function CustomerPage() {
  const { notify, confirm } = useNotification();

  const [customers, setCustomers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(createEmptyForm());
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [searchText, setSearchText] = useState("");
  const deferredSearchText = useDeferredValue(searchText);

  const [currentPage, setCurrentPage] = useState(1);

  const [catalogOptions, setCatalogOptions] = useState({
    objectType: [],
    occupation: [],
    hamlet: [],
    group: [],
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

    if (!keyword) return customers;

    return searchableCustomers
      .filter(({ searchIndex }) => searchIndex.includes(keyword))
      .map(({ customer }) => customer);
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
    Math.ceil(filteredCustomers.length / PAGE_SIZE)
  );

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;

    return filteredCustomers.slice(
      startIndex,
      startIndex + PAGE_SIZE
    );
  }, [currentPage, filteredCustomers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
      ] = await Promise.all(
        [
          "objectType",
          "occupation",
          "hamlet",
          "group",
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

      setCatalogOptions({
        objectType: objectTypeOptions,
        occupation: occupationOptions,
        hamlet: hamletOptions,
        group: groupOptions,
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
  // TỰ ĐỘNG ĐỔI ĐỐI TƯỢNG KHI NHẬP NĂM SINH
  // CHỈ ÁP DỤNG KHI THÊM MỚI
  // =====================================================
  const handleBirthYearBlur = () => {
    setForm((prevForm) => {
      // Khi sửa hồ sơ:
      // không tự động thay đổi đối tượng
      if (editingId !== null) {
        return prevForm;
      }

      const birthYear = Number(prevForm.taxCode);

      if (
        prevForm.taxCode !== "" &&
        Number.isFinite(birthYear) &&
        birthYear <= 1966
      ) {
        return {
          ...prevForm,
          objectType: "NGƯỜI CAO TUỔI",
        };
      }

      return prevForm;
    });
  };

  const handleBirthDateChange = (date) => {
    setForm((prevForm) => ({
      ...prevForm,
      birthDate: date,
      taxCode: date
        ? String(date.getFullYear())
        : prevForm.taxCode,
    }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,

      code: form.code.trim(),
      name: form.name.trim(),
      objectType: form.objectType.trim(),
      phoneNumber: form.phoneNumber.trim(),
      address: form.address.trim(),
      taxCode: form.taxCode.trim(),
      occupation: form.occupation.trim(),

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
                  placeholder="Nhập số căn cước"
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
                    setForm(
                      (prevForm) => ({
                        ...prevForm,
                        examinationDate:
                          date,
                      })
                    )
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
                        style={{
                          background:
                            "#ffffff",
                        }}
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
                            PAGE_SIZE +
                            index +
                            1}
                        </td>

                        <td
                          className={
                            String(
                              customer.examinationDate ??
                                ""
                            ).substring(
                              0,
                              10
                            ) ===
                            todayDate
                              ? "text-center fw-bold text-primary"
                              : "text-center"
                          }
                        >
                          {formatExaminationDate(
                            customer.examinationDate
                          )}
                        </td>

                        <td>
                          <div className="fw-bold text-dark mb-2">
                            {
                              customer.name ||
                              "Chưa có họ tên"
                            }
                          </div>

                          <div className="row row-cols-1 row-cols-md-2 g-1 small text-muted">
                            <div className="col">
                              <span className="fw-semibold text-body">
                                Căn cước:{" "}
                              </span>

                              {
                                customer.code ||
                                "—"
                              }
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
                                Ngày sinh:{" "}
                              </span>

                              {formatExaminationDate(
                                customer.birthDate
                              ) || "—"}
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
                          </div>
                        </td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>

          {/* PHÂN TRANG */}
          {filteredCustomers.length >
            PAGE_SIZE && (
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
              <span className="text-muted">
                Hiển thị{" "}
                {(currentPage -
                  1) *
                  PAGE_SIZE +
                  1}
                -
                {Math.min(
                  currentPage *
                    PAGE_SIZE,
                  filteredCustomers.length
                )}{" "}
                /{" "}
                {
                  filteredCustomers.length
                }{" "}
                dòng
              </span>

              <div
                className="btn-group"
                role="group"
                aria-label="Phân trang"
              >
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.max(
                          1,
                          page - 1
                        )
                    )
                  }
                  disabled={
                    currentPage ===
                    1
                  }
                >
                  Trước
                </button>

                <span className="btn btn-outline-secondary disabled">
                  Trang{" "}
                  {
                    currentPage
                  }
                  /
                  {
                    totalPages
                  }
                </span>

                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() =>
                    setCurrentPage(
                      (page) =>
                        Math.min(
                          totalPages,
                          page + 1
                        )
                    )
                  }
                  disabled={
                    currentPage ===
                    totalPages
                  }
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CustomerPage;