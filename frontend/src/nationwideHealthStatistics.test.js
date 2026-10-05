import assert from "node:assert/strict";
import { test } from "node:test";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  countHealthRecordsByHamlet,
  filterSecondRoundHealthRecords,
  findNationwideHealthWorksheet,
  isGeneratedNationwideHealthWorkbook,
  KSK_SECOND_ROUND_START_DATE,
  localDateKey,
  NATIONWIDE_HAMLETS,
  populateNationwideHealthWorkbook,
} from "./nationwideHealthStatistics.js";
import { findCustomerHamlet } from "./hamletMatching.js";

test("counts health records by normalized hamlet name and TBC abbreviation", () => {
  const result = countHealthRecordsByHamlet([
    { address: "Ấp 1, xã Tân Hòa" },
    { address: "Ap 2; Tan Hoa" },
    { address: "TBC, xã Tân Hòa" },
    { address: "Trảng Ba Chân, Tân Hòa" },
    { address: "TBC (Trảng Ba Chân)" },
    { address: "Ấp TBC xã Tân Hòa" },
    { address: "Địa chỉ chưa xác định" },
  ]);

  assert.equal(result.counts[0], 1);
  assert.equal(result.counts[1], 1);
  assert.equal(result.counts[5], 4);
  assert.equal(result.unmatchedCount, 1);
  assert.equal(result.counts.reduce((total, count) => total + count, 0), 6);
});

test("statistics and search assign each address to the same catalog hamlet", () => {
  const hamlets = NATIONWIDE_HAMLETS.map((name, id) => ({ id, name }));
  const records = [
    { address: "Ấp 1, xã Tân Hòa" },
    { address: "Ấp 1, xã Tân Hòa, tuyến 2" },
    { address: "Ấp 10, xã Tân Hòa" },
    { address: "TBC, xã Tân Hòa" },
    { address: "xã Tân Hòa, khu vực Ấp 1, tuyến 2" },
    { address: "Địa chỉ chưa xác định" },
  ];
  const searchCounts = Array(hamlets.length).fill(0);
  let searchUnmatchedCount = 0;
  for (const record of records) {
    const match = findCustomerHamlet(record, hamlets);
    if (match) searchCounts[match.id]++;
    else searchUnmatchedCount++;
  }

  const statistics = countHealthRecordsByHamlet(records, hamlets);

  assert.deepEqual(statistics.counts, searchCounts);
  assert.equal(statistics.unmatchedCount, searchUnmatchedCount);
});

test("filters second-round health records inclusively from September 8 through the selected end date", () => {
  const records = [
    { examinationDate: "2026-09-07T00:00:00Z", address: "Ấp 1" },
    { examinationDate: "2026-09-08T00:00:00Z", address: "Ấp 1" },
    { examinationDate: "2026-09-25T23:59:59Z", address: "TBC" },
    { examinationDate: "2026-10-05T23:59:59Z", address: "Ấp 2" },
    { examinationDate: "2026-10-06T00:00:00Z", address: "Ấp 3" },
    { examinationDate: null, address: "Ấp 3" },
  ];

  const filteredRecords = filterSecondRoundHealthRecords(records, "2026-10-05");
  const result = countHealthRecordsByHamlet(filteredRecords);

  assert.equal(KSK_SECOND_ROUND_START_DATE, "2026-09-08");
  assert.equal(localDateKey(new Date(2026, 9, 5)), "2026-10-05");
  assert.equal(filteredRecords.length, 3);
  assert.equal(result.counts[0], 1);
  assert.equal(result.counts[1], 1);
  assert.equal(result.counts[5], 1);
  assert.equal(result.counts.reduce((total, count) => total + count, 0), 3);
});

test("finds the expected worksheet", () => {
  const worksheet = {};
  NATIONWIDE_HAMLETS.forEach((hamlet, index) => {
    worksheet[`C${index + 6}`] = { t: "s", v: hamlet };
  });
  const workbook = { SheetNames: ["other", "stats"], Sheets: { other: {}, stats: worksheet } };

  assert.equal(findNationwideHealthWorksheet(workbook), worksheet);
});

test("recognizes already exported workbook names", () => {
  assert.equal(isGeneratedNationwideHealthWorkbook("report_da_dien_so_lieu.xlsx"), true);
  assert.equal(isGeneratedNationwideHealthWorkbook("report_da_dien_so_lieu_da_dien_so_lieu.xlsx"), true);
  assert.equal(isGeneratedNationwideHealthWorkbook("Số liệu khám sức khỏe toàn dân (chuẩn).xlsx"), false);
});

test("updates only the target worksheet XML, preserving the original workbook parts", () => {
  const otherParts = {
    "[Content_Types].xml": strToU8("<Types><Override PartName=\"/xl/worksheets/sheet1.xml\"/></Types>"),
    "xl/styles.xml": strToU8("<styleSheet><cellXfs count=\"1\"/></styleSheet>"),
    "xl/sharedStrings.xml": strToU8("<sst><si><t>Keep exact shared strings</t></si></sst>"),
  };
  const sheetRows = NATIONWIDE_HAMLETS.map((hamlet, index) => {
    const row = index + 6;
    return `<row r="${row}"><c r="C${row}" t="inlineStr"><is><t>${hamlet}</t></is></c><c r="W${row}" s="3"><v>100</v></c><c r="X${row}" s="5"><v>1</v></c><c r="Y${row}" s="2"/><c r="Z${row}" s="8"><f>W${row}-Y${row}</f><v>10</v></c></row>`;
  }).join("");
  const originalSheet = `<worksheet><sheetData>${sheetRows}<row r="18"><c r="W18" s="3"><v>1200</v></c><c r="Y18" s="9"><f>SUM(Y6:Y17)</f><v>0</v></c><c r="Z18" s="9"><f>W18-Y18</f><v>1200</v></c></row></sheetData><mergeCells count="1"><mergeCell ref="B1:C1"/></mergeCells></worksheet>`;
  const originalFiles = {
    ...otherParts,
    "xl/workbook.xml": strToU8("<workbook><sheets><sheet name=\"stats\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>"),
    "xl/_rels/workbook.xml.rels": strToU8("<Relationships><Relationship Id=\"rId1\" Target=\"worksheets/sheet1.xml\" Type=\"worksheet\"/></Relationships>"),
    "xl/worksheets/sheet1.xml": strToU8(originalSheet),
  };
  const input = zipSync(originalFiles);
  const counts = NATIONWIDE_HAMLETS.map((_, index) => index + 1);
  const output = populateNationwideHealthWorkbook(input, "stats", counts);
  const outputFiles = unzipSync(output);
  const outputSheet = strFromU8(outputFiles["xl/worksheets/sheet1.xml"]);

  for (const [path, content] of Object.entries(otherParts)) {
    assert.deepEqual(outputFiles[path], content);
  }
  assert.match(outputSheet, /<c r="Y6" s="2"><v>1<\/v><\/c>/);
  assert.match(outputSheet, /<c r="Y17" s="2"><v>12<\/v><\/c>/);
  assert.match(outputSheet, /<c r="Y18" s="9"><f>SUM\(Y6:Y17\)<\/f><v>78<\/v><\/c>/);
  assert.match(outputSheet, /<c r="Z6" s="8"><f>W6-Y6<\/f><v>99<\/v><\/c>/);
  assert.match(outputSheet, /<c r="Z17" s="8"><f>W17-Y17<\/f><v>88<\/v><\/c>/);
  assert.match(outputSheet, /<c r="Z18" s="9"><f>W18-Y18<\/f><v>1122<\/v><\/c>/);
  assert.match(outputSheet, /<mergeCell ref="B1:C1"\/>/);
  assert.notEqual(outputSheet, originalSheet);
});

test("rejects workbooks that do not contain the expected hamlet rows", () => {
  assert.throws(
    () => findNationwideHealthWorksheet({ SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } }),
    /không đúng mẫu/i,
  );
});
