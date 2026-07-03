import { describe, expect, test } from "bun:test";
import { safeNext } from "./redirect";
import { ROUTES } from "@/lib/routes";

describe("safeNext", () => {
  test("passes through same-origin absolute paths", () => {
    expect(safeNext("/checkout")).toBe("/checkout");
    expect(safeNext("/account/orders")).toBe("/account/orders");
    expect(safeNext("/product/kundan-set?tone=gold")).toBe(
      "/product/kundan-set?tone=gold",
    );
  });

  test("falls back for empty / missing values", () => {
    expect(safeNext(null)).toBe(ROUTES.account);
    expect(safeNext(undefined)).toBe(ROUTES.account);
    expect(safeNext("")).toBe(ROUTES.account);
  });

  test("rejects absolute URLs to other origins", () => {
    expect(safeNext("https://evil.example")).toBe(ROUTES.account);
    expect(safeNext("http://evil.example/checkout")).toBe(ROUTES.account);
  });

  test("rejects protocol-relative and backslash tricks", () => {
    expect(safeNext("//evil.example")).toBe(ROUTES.account);
    expect(safeNext("/\\evil.example")).toBe(ROUTES.account);
    expect(safeNext("/valid\\..\\path")).toBe(ROUTES.account);
  });

  test("rejects javascript: and other schemes", () => {
    expect(safeNext("javascript:alert(1)")).toBe(ROUTES.account);
    expect(safeNext("data:text/html,x")).toBe(ROUTES.account);
  });

  test("honours a custom fallback", () => {
    expect(safeNext(null, "/checkout")).toBe("/checkout");
    expect(safeNext("//evil.example", "/checkout")).toBe("/checkout");
  });
});
