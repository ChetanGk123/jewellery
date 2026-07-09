/**
 * xlsx I/O for the bulk export/import — the only module that touches exceljs.
 * Server-side by usage (route handlers + server actions only); it has no
 * `server-only` marker solely so the Bun round-trip test can exercise it.
 */

import ExcelJS from "exceljs"
import { type BulkColumn, type RawRow, MAX_IMPORT_FILE_BYTES, MAX_IMPORT_ROWS } from "./types"

/** Rows below the data that still get dropdown validation (new creates). */
const DROPDOWN_SPARE_ROWS = 200

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF2A0A12" }, // brand maroon
}

const READONLY_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1ECE3" },
}

export type BuildWorkbookOptions = {
  sheetName: string
  columns: BulkColumn[]
  rows: Array<Array<string | number | boolean>>
  /** Named lists referenced by BulkColumn.dropdown, fed from a hidden sheet. */
  dropdowns?: Record<string, string[]>
}

/** Build a styled workbook: locked-look header, text columns, dropdowns. */
export async function buildWorkbook(opts: BuildWorkbookOptions): Promise<Uint8Array<ArrayBuffer>> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(opts.sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  })

  sheet.columns = opts.columns.map((col) => ({
    header: col.header,
    width: col.width ?? 18,
    style: col.text ? { numFmt: "@" } : {},
  }))

  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: "FFF3E3C7" } }
  headerRow.fill = HEADER_FILL

  for (const row of opts.rows) sheet.addRow(row)

  // Grey the read-only columns so they read as reference, not inputs.
  opts.columns.forEach((col, idx) => {
    if (!col.readOnly) return
    for (let r = 2; r <= opts.rows.length + 1; r += 1) {
      const cell = sheet.getRow(r).getCell(idx + 1)
      cell.fill = READONLY_FILL
      cell.font = { color: { argb: "FF8A7E74" } }
    }
  })

  // Hidden Lists sheet feeds the dropdowns (inline list formulae cap at 255
  // chars, which a long category list would blow past).
  const dropdowns = opts.dropdowns ?? {}
  const listNames = Object.keys(dropdowns).filter((name) => dropdowns[name].length > 0)
  if (listNames.length > 0) {
    const lists = workbook.addWorksheet("Lists", { state: "veryHidden" })
    listNames.forEach((name, listIdx) => {
      const columnLetter = lists.getColumn(listIdx + 1).letter
      lists.getCell(1, listIdx + 1).value = name
      dropdowns[name].forEach((value, i) => {
        lists.getCell(i + 2, listIdx + 1).value = value
      })
      const range = `Lists!$${columnLetter}$2:$${columnLetter}$${dropdowns[name].length + 1}`
      opts.columns.forEach((col, colIdx) => {
        if (col.dropdown !== name) return
        const last = opts.rows.length + 1 + DROPDOWN_SPARE_ROWS
        for (let r = 2; r <= last; r += 1) {
          sheet.getRow(r).getCell(colIdx + 1).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: [range],
          }
        }
      })
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer as ArrayBuffer)
}

export type ReadRowsResult = { ok: true; rows: RawRow[] } | { ok: false; error: string }

/** Unwrap exceljs cell values (rich text, hyperlinks, formulas) to primitives. */
function plainCellValue(value: ExcelJS.CellValue): unknown {
  if (value == null) return null
  if (typeof value === "object") {
    if (value instanceof Date) return value
    if ("richText" in value) return value.richText.map((part) => part.text).join("")
    if ("hyperlink" in value) return value.text ?? value.hyperlink
    if ("result" in value) return value.result ?? null
    if ("error" in value) return null
    return String(value)
  }
  return value
}

/**
 * Read the entity sheet back: size/shape checks, header verification, then
 * one RawRow per non-empty data row keyed by header (rowNum = sheet row).
 */
export async function readRows(file: File, expectedHeaders: string[]): Promise<ReadRowsResult> {
  if (file.size === 0) return { ok: false, error: "The file is empty." }
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return { ok: false, error: "File is over 4 MB — export a fresh sheet and edit that." }
  }
  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    return { ok: false, error: "Upload the .xlsx file exported from this page." }
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(await file.arrayBuffer())
  } catch {
    return { ok: false, error: "Couldn't read that file as an Excel workbook (.xlsx)." }
  }

  const sheet = workbook.worksheets.find((ws) => ws.name !== "Lists")
  if (!sheet) return { ok: false, error: "The workbook has no data sheet." }

  const headers = expectedHeaders.map((_, idx) =>
    String(sheet.getRow(1).getCell(idx + 1).text ?? "").trim(),
  )
  const mismatch = expectedHeaders.findIndex((expected, idx) => headers[idx] !== expected)
  if (mismatch !== -1) {
    return {
      ok: false,
      error: `Column ${mismatch + 1} should be "${expectedHeaders[mismatch]}" — export a fresh sheet and keep the header row intact.`,
    }
  }

  const rows: RawRow[] = []
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const row = sheet.getRow(r)
    const cells: Record<string, unknown> = {}
    let hasValue = false
    expectedHeaders.forEach((header, idx) => {
      const value = plainCellValue(row.getCell(idx + 1).value)
      if (value !== null && value !== "") hasValue = true
      cells[header] = value
    })
    if (!hasValue) continue
    rows.push({ rowNum: r, cells })
    if (rows.length > MAX_IMPORT_ROWS) {
      return { ok: false, error: `Imports are capped at ${MAX_IMPORT_ROWS} rows per file.` }
    }
  }

  return { ok: true, rows }
}
