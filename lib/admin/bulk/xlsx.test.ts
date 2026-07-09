import { test, expect } from "bun:test"
import type { BulkColumn } from "./types"
import { buildWorkbook, readRows } from "./xlsx"

const COLUMNS: BulkColumn[] = [
  { header: "ID", text: true },
  { header: "Name" },
  { header: "Qty" },
  { header: "Active", dropdown: "bool" },
  { header: "Note", readOnly: true },
]

function asFile(bytes: Uint8Array, name = "test.xlsx"): File {
  return new File([new Uint8Array(bytes)], name)
}

test("buildWorkbook → readRows round-trips values (exceljs-under-Bun smoke)", async () => {
  const bytes = await buildWorkbook({
    sheetName: "Things",
    columns: COLUMNS,
    rows: [
      ["007", "Ring, gold | polished", 3, true, "ref"],
      ["", "Näth ₹", 0, false, ""],
    ],
    dropdowns: { bool: ["TRUE", "FALSE"] },
  })

  const result = await readRows(
    asFile(bytes),
    COLUMNS.map((c) => c.header),
  )
  expect(result.ok).toBe(true)
  const rows = result.ok ? result.rows : []
  expect(rows).toHaveLength(2)
  expect(rows[0].rowNum).toBe(2)
  // Text-format column keeps the leading zeros; unicode + commas survive.
  expect(rows[0].cells["ID"]).toBe("007")
  expect(rows[0].cells["Name"]).toBe("Ring, gold | polished")
  expect(rows[0].cells["Qty"]).toBe(3)
  expect(rows[0].cells["Active"]).toBe(true)
  expect(rows[1].cells["Name"]).toBe("Näth ₹")
})

test("readRows rejects a tampered header row", async () => {
  const bytes = await buildWorkbook({
    sheetName: "Things",
    columns: [{ header: "Wrong" }, { header: "Name" }],
    rows: [],
  })
  const result = await readRows(
    asFile(bytes),
    COLUMNS.map((c) => c.header),
  )
  expect(result.ok ? "" : result.error).toContain('"ID"')
})

test("readRows rejects non-xlsx filenames and empty files", async () => {
  const junk = await readRows(asFile(new TextEncoder().encode("a,b,c"), "data.csv"), ["ID"])
  expect(junk.ok ? "" : junk.error).toContain(".xlsx")

  const empty = await readRows(asFile(new Uint8Array(0)), ["ID"])
  expect(empty.ok).toBe(false)
})
