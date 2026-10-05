import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { findCustomerHamlet, normalizeHamletName } from "./hamletMatching.js";

export const NATIONWIDE_HAMLETS = [
  "Ấp 1",
  "Ấp 2",
  "Ấp 3",
  "Ấp 4",
  "Ấp 5",
  "Ấp Trảng Ba Chân",
  "Ấp Trảng Trai",
  "Ấp Suối Bà Chiêm",
  "Ấp Tân Thuận",
  "Ấp Cây Khế",
  "Ấp Cây Cầy",
  "Ấp Con Trăn",
];

export const KSK_SECOND_ROUND_START_DATE = "2026-09-08";
export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function filterSecondRoundHealthRecords(records, endDate = localDateKey()) {
  return records.filter(({ examinationDate }) => {
    const date = String(examinationDate ?? "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date)
      && date >= KSK_SECOND_ROUND_START_DATE
      && date <= endDate;
  });
}

export function isGeneratedNationwideHealthWorkbook(fileName) {
  return /_da_dien_so_lieu(?:_da_dien_so_lieu)*\.xlsx$/i.test(String(fileName ?? ""));
}

export { normalizeHamletName };

export function countHealthRecordsByHamlet(records, hamlets = NATIONWIDE_HAMLETS.map((name, id) => ({ id, name }))) {
  const names = NATIONWIDE_HAMLETS.map(normalizeHamletName);
  const counts = Array(names.length).fill(0);
  let unmatchedCount = 0;

  for (const record of records) {
    const matchedHamlet = findCustomerHamlet(record, hamlets);
    const index = matchedHamlet
      ? names.indexOf(normalizeHamletName(matchedHamlet.name))
      : -1;
    if (index === -1) {
      unmatchedCount++;
      continue;
    }
    counts[index]++;
  }

  return { counts, unmatchedCount };
}

export function findNationwideHealthWorksheet(workbook) {
  for (const name of workbook.SheetNames) {
    const worksheet = workbook.Sheets[name];
    const hasExpectedHamlets = NATIONWIDE_HAMLETS.every((hamlet, index) =>
      normalizeHamletName(worksheet[`C${index + 6}`]?.v) === normalizeHamletName(hamlet),
    );
    if (hasExpectedHamlets) return worksheet;
  }
  throw new Error("File Excel không đúng mẫu số liệu khám sức khỏe toàn dân (cần đủ tên ấp tại C6:C17).");
}

function decodeXml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseXmlAttributes(tag) {
  const attributes = {};
  for (const match of tag.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes[match[1]] = decodeXml(match[2] ?? match[3]);
  }
  return attributes;
}

function resolveZipPath(basePath, target) {
  const segments = target.startsWith("/") ? [] : basePath.split("/").slice(0, -1);
  for (const segment of target.replace(/^\/+/, "").split("/")) {
    if (segment === "..") segments.pop();
    else if (segment !== "." && segment !== "") segments.push(segment);
  }
  return segments.join("/");
}

function worksheetZipPath(files, worksheetName) {
  const workbookXml = files["xl/workbook.xml"];
  const relationshipsXml = files["xl/_rels/workbook.xml.rels"];
  if (!workbookXml || !relationshipsXml) {
    throw new Error("File Excel không có cấu trúc workbook hợp lệ.");
  }

  const sheetsXml = strFromU8(workbookXml);
  const sheet = [...sheetsXml.matchAll(/<(?:\w+:)?sheet\b[^>]*\/?>/g)]
    .map(([tag]) => parseXmlAttributes(tag))
    .find((attributes) => attributes.name === worksheetName);
  if (!sheet?.["r:id"]) {
    throw new Error(`Không tìm thấy trang tính "${worksheetName}" trong file Excel.`);
  }

  const relationships = strFromU8(relationshipsXml);
  const relationship = [...relationships.matchAll(/<(?:\w+:)?Relationship\b[^>]*\/?>/g)]
    .map(([tag]) => parseXmlAttributes(tag))
    .find((attributes) => attributes.Id === sheet["r:id"]);
  if (!relationship?.Target) {
    throw new Error(`Không tìm thấy dữ liệu của trang tính "${worksheetName}".`);
  }

  const path = resolveZipPath("xl/workbook.xml", relationship.Target);
  if (!files[path]) {
    throw new Error(`Không đọc được nội dung trang tính "${worksheetName}".`);
  }
  return path;
}

function columnNumber(cellReference) {
  const letters = cellReference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  let number = 0;
  for (const letter of letters) number = number * 26 + letter.charCodeAt(0) - 64;
  return number;
}

function findCell(xml, reference) {
  for (const match of xml.matchAll(/<c\b[^>]*?\/>|<c\b[^>]*>[\s\S]*?<\/c>/g)) {
    const tagEnd = match[0].indexOf(">");
    const attributes = parseXmlAttributes(match[0].slice(0, tagEnd + 1));
    if (attributes.r === reference) {
      return { xml: match[0], index: match.index, attributes, tagEnd };
    }
  }
  return null;
}

function numericCellValue(xml, reference) {
  const cell = findCell(xml, reference);
  if (!cell) return null;
  const valueMatch = cell.xml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
  if (!valueMatch) return null;
  const value = Number(valueMatch[1]);
  return Number.isFinite(value) ? value : null;
}

function writeCellNumber(xml, reference, value) {
  const existing = findCell(xml, reference);
  if (existing) {
    const openingTag = existing.xml.slice(0, existing.tagEnd + 1);
    const numericOpeningTag = openingTag
      .replace(/\s+t=(?:"[^"]*"|'[^']*')/g, "")
      .replace(/\s*\/>$/, ">");
    const hasBody = !openingTag.endsWith("/>");
    const body = hasBody ? existing.xml.slice(existing.tagEnd + 1, existing.xml.lastIndexOf("</c>")) : "";
    const valueElement = `<v>${value}</v>`;
    const updatedBody = /<v\b[^>]*(?:\/>|>[\s\S]*?<\/v>)/.test(body)
      ? body.replace(/<v\b[^>]*(?:\/>|>[\s\S]*?<\/v>)/, valueElement)
      : `${body}${valueElement}`;
    const updatedCell = `${numericOpeningTag}${updatedBody}</c>`;
    return `${xml.slice(0, existing.index)}${updatedCell}${xml.slice(existing.index + existing.xml.length)}`;
  }

  const rowNumber = reference.match(/\d+$/)?.[0];
  const rowMatch = [...xml.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)]
    .find((match) => parseXmlAttributes(match[0].slice(0, match[0].indexOf(">"))).r === rowNumber);
  if (!rowMatch) throw new Error(`Không tìm thấy dòng ${rowNumber} trong mẫu Excel.`);

  const targetColumn = columnNumber(reference);
  const rowXml = rowMatch[0];
  const cells = [...rowXml.matchAll(/<c\b[^>]*?\/>|<c\b[^>]*>[\s\S]*?<\/c>/g)];
  const followingCell = cells.find((match) => {
    const end = match[0].indexOf(">");
    return columnNumber(parseXmlAttributes(match[0].slice(0, end + 1)).r ?? "") > targetColumn;
  });
  const precedingCells = cells.filter((match) => {
    const end = match[0].indexOf(">");
    return columnNumber(parseXmlAttributes(match[0].slice(0, end + 1)).r ?? "") < targetColumn;
  });
  const styleCell = [...precedingCells].reverse().find((match) => {
    const end = match[0].indexOf(">");
    return parseXmlAttributes(match[0].slice(0, end + 1)).s;
  }) ?? cells.find((match) => {
    const end = match[0].indexOf(">");
    return parseXmlAttributes(match[0].slice(0, end + 1)).s;
  });
  const style = styleCell
    ? parseXmlAttributes(styleCell[0].slice(0, styleCell[0].indexOf(">"))).s
    : null;
  const newCell = `<c r="${reference}"${style ? ` s="${style}"` : ""}><v>${value}</v></c>`;
  const insertionIndex = followingCell
    ? rowMatch.index + followingCell.index
    : rowMatch.index + rowXml.lastIndexOf("</row>");
  return `${xml.slice(0, insertionIndex)}${newCell}${xml.slice(insertionIndex)}`;
}

function patchWorksheetXml(xml, counts) {
  let updatedXml = xml;
  counts.forEach((count, index) => {
    updatedXml = writeCellNumber(updatedXml, `Y${index + 6}`, count);
  });

  const total = counts.reduce((sum, count) => sum + count, 0);
  for (let row = 6; row <= 17; row++) {
    const formulaCell = findCell(updatedXml, `Z${row}`);
    const remaining = numericCellValue(updatedXml, `W${row}`);
    if (formulaCell?.xml.includes("<f") && remaining !== null) {
      updatedXml = writeCellNumber(updatedXml, `Z${row}`, remaining - counts[row - 6]);
    }
  }

  if (findCell(updatedXml, "Y18")) {
    updatedXml = writeCellNumber(updatedXml, "Y18", total);
  }
  const totalRemaining = numericCellValue(updatedXml, "W18");
  if (findCell(updatedXml, "Z18")?.xml.includes("<f") && totalRemaining !== null) {
    updatedXml = writeCellNumber(updatedXml, "Z18", totalRemaining - total);
  }
  return updatedXml;
}

export function populateNationwideHealthWorkbook(fileBuffer, worksheetName, counts) {
  if (counts.length !== NATIONWIDE_HAMLETS.length) {
    throw new Error("Số liệu phải có đúng 12 dòng tương ứng với 12 ấp.");
  }
  const files = unzipSync(new Uint8Array(fileBuffer));
  const worksheetPath = worksheetZipPath(files, worksheetName);
  files[worksheetPath] = strToU8(patchWorksheetXml(strFromU8(files[worksheetPath]), counts));
  return zipSync(files, { level: 6 });
}
