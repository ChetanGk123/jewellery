import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { loadAdmin } from "./admin-read";

afterEach(() => mock.restore());

test("loadAdmin returns the data with error:false on success", async () => {
  const result = await loadAdmin("probe", async () => ({ n: 42 }), { n: 0 });
  expect(result).toEqual({ data: { n: 42 }, error: false });
});

test("loadAdmin returns the fallback with error:true when the read throws", async () => {
  const logSpy = spyOn(console, "error").mockImplementation(() => {});
  const fallback = { n: 0 };

  const result = await loadAdmin(
    "probe",
    async () => {
      throw new Error("db down");
    },
    fallback,
  );

  expect(result).toEqual({ data: fallback, error: true });
  // The whole point of 5.1: the failure is logged, never swallowed silently.
  expect(logSpy).toHaveBeenCalledTimes(1);
});
