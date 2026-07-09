import { describe, expect, test } from "bun:test"
import { aggregateTopCustomers } from "./top-customers"

const order = (phone: string, name: string, totalPaise: number, status = "Delivered") => ({
  customerName: name,
  customerPhone: phone,
  totalPaise,
  status,
})

describe("aggregateTopCustomers", () => {
  test("groups by phone, sums revenue, counts orders, sorts by revenue", () => {
    // Arrange
    const rows = [
      order("9000000001", "Asha", 100000),
      order("9000000002", "Meera", 500000),
      order("9000000001", "Asha", 300000),
    ]

    // Act
    const top = aggregateTopCustomers(rows)

    // Assert
    expect(top).toEqual([
      { name: "Meera", phone: "9000000002", orders: 1, revenuePaise: 500000 },
      { name: "Asha", phone: "9000000001", orders: 2, revenuePaise: 400000 },
    ])
  })

  test("cancelled orders count for nothing", () => {
    const rows = [
      order("9000000001", "Asha", 100000),
      order("9000000001", "Asha", 900000, "Cancelled"),
    ]
    expect(aggregateTopCustomers(rows)).toEqual([
      { name: "Asha", phone: "9000000001", orders: 1, revenuePaise: 100000 },
    ])
  })

  test("customers with only cancelled orders are dropped", () => {
    expect(aggregateTopCustomers([order("9000000001", "Asha", 100000, "Cancelled")])).toEqual([])
  })

  test("keeps the first-seen name (rows arrive newest first) and caps the list", () => {
    const rows = [
      order("9000000001", "Asha Rao", 100000), // newest — she renamed herself
      order("9000000001", "Asha", 200000),
      ...Array.from({ length: 6 }, (_, i) => order(`90000001${i}`, `C${i}`, (i + 1) * 1000)),
    ]
    const top = aggregateTopCustomers(rows, 3)
    expect(top).toHaveLength(3)
    expect(top[0]).toEqual({
      name: "Asha Rao",
      phone: "9000000001",
      orders: 2,
      revenuePaise: 300000,
    })
  })
})
