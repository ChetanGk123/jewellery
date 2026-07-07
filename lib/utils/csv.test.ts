import { describe, expect, test } from "bun:test";
import { csvCell, csvRow } from "./csv";

describe("csvCell", () => {
  test("passes plain values through untouched", () => {
    expect(csvCell("JR-1024")).toBe("JR-1024");
  });

  test("quotes values containing commas", () => {
    expect(csvCell("Jaipur, Rajasthan")).toBe('"Jaipur, Rajasthan"');
  });

  test("doubles embedded quotes and wraps", () => {
    expect(csvCell('the "big" one')).toBe('"the ""big"" one"');
  });

  test("quotes values containing newlines", () => {
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("csvRow", () => {
  test("joins escaped cells with commas", () => {
    expect(csvRow(["a", "b,c", "d"])).toBe('a,"b,c",d');
  });
});
