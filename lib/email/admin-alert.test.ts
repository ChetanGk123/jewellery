import { expect, test } from "bun:test";
import { buildNewOrderAdminEmail } from "./admin-alert";

const base = {
  orderNo: "JR-260706-1001-AB12",
  customerName: "Aarav",
  city: "Jaipur",
  state: "Rajasthan",
  itemCount: 2,
  totalPaise: 329900,
  adminUrl: "https://shop.example/admin/orders",
};

test("subject and bodies carry order no, total and the console link", () => {
  const msg = buildNewOrderAdminEmail(base);

  expect(msg.subject).toContain(base.orderNo);
  expect(msg.subject).toContain("₹3,299");
  for (const body of [msg.html, msg.text]) {
    expect(body).toContain(base.orderNo);
    expect(body).toContain("Jaipur, Rajasthan");
    expect(body).toContain("₹3,299");
    expect(body).toContain(base.adminUrl);
  }
});

test("pluralises the item count", () => {
  expect(buildNewOrderAdminEmail({ ...base, itemCount: 1 }).text).toContain("1 item");
  expect(buildNewOrderAdminEmail({ ...base, itemCount: 3 }).text).toContain("3 items");
});

test("HTML-escapes the customer name", () => {
  const msg = buildNewOrderAdminEmail({ ...base, customerName: "<b>x</b>" });
  expect(msg.html).not.toContain("<b>x</b>");
  expect(msg.html).toContain("&lt;b&gt;x&lt;/b&gt;");
});
