import { describe, expect, it } from "vitest"
import {
  localEndOfDayUtcInstant,
  localStartOfDayUtcInstant,
} from "@workspace/ui/lib/date"

import {
  clearRoleFilter,
  EMPTY_ROLE_FILTERS,
  roleFilterChips,
  roleFiltersFromCrud,
  roleFiltersToCrud,
} from "@/features/roles/utils/filters"

describe("roleFiltersToCrud", () => {
  it("returns no filters for empty values", () => {
    expect(roleFiltersToCrud(EMPTY_ROLE_FILTERS)).toEqual([])
  })

  it("maps text filters to contains", () => {
    expect(
      roleFiltersToCrud({
        ...EMPTY_ROLE_FILTERS,
        title: "admin",
        description: "team",
      })
    ).toEqual([
      { field: "title", operator: "contains", value: "admin" },
      { field: "description", operator: "contains", value: "team" },
    ])
  })

  it("maps one status to eq and several statuses to in, in order", () => {
    expect(
      roleFiltersToCrud({ ...EMPTY_ROLE_FILTERS, status: "inactive" })
    ).toEqual([{ field: "status", operator: "eq", value: "inactive" }])
    expect(
      roleFiltersToCrud({
        ...EMPTY_ROLE_FILTERS,
        status: "active, inactive",
      })
    ).toEqual([
      { field: "status", operator: "in", value: ["active", "inactive"] },
    ])
  })

  it("maps date bounds to the start and end of each local day", () => {
    expect(
      roleFiltersToCrud({
        ...EMPTY_ROLE_FILTERS,
        createdAtFrom: "2026-01-02",
        updatedAtTo: "2026-01-03",
      })
    ).toEqual([
      {
        field: "createdAt",
        operator: "gte",
        value: localStartOfDayUtcInstant("2026-01-02"),
      },
      {
        field: "updatedAt",
        operator: "lte",
        value: localEndOfDayUtcInstant("2026-01-03"),
      },
    ])
  })

  it("treats an overflowed date as no bound instead of throwing", () => {
    // `2026-02-31` passes the date-only shape but is not a calendar day.
    expect(
      roleFiltersToCrud({
        ...EMPTY_ROLE_FILTERS,
        createdAtFrom: "2026-02-31",
        updatedAtTo: "2026-02-31",
      })
    ).toEqual([])
  })
})

describe("roleFiltersFromCrud", () => {
  it("returns empty values for an empty filter list", () => {
    expect(roleFiltersFromCrud([])).toEqual(EMPTY_ROLE_FILTERS)
  })

  it("round-trips the editable values", () => {
    const values = {
      title: "admin",
      description: "team",
      status: "active,inactive",
      createdAtFrom: "2026-01-02",
      createdAtTo: "2026-01-03",
      updatedAtFrom: "2026-02-01",
      updatedAtTo: "2026-02-28",
    }
    expect(roleFiltersFromCrud(roleFiltersToCrud(values))).toEqual(values)
  })

  it("drops unknown statuses and collapses instants to local days", () => {
    expect(
      roleFiltersFromCrud([
        { field: "status", operator: "in", value: ["active", "bogus"] },
        {
          field: "createdAt",
          operator: "gte",
          value: localStartOfDayUtcInstant("2026-01-02"),
        },
      ])
    ).toEqual({
      ...EMPTY_ROLE_FILTERS,
      status: "active",
      createdAtFrom: "2026-01-02",
    })
  })
})

describe("clearRoleFilter", () => {
  it("clears both bounds of a date range and leaves the rest", () => {
    expect(
      clearRoleFilter(
        {
          ...EMPTY_ROLE_FILTERS,
          title: "admin",
          createdAtFrom: "2026-01-02",
          createdAtTo: "2026-01-03",
        },
        "createdAt"
      )
    ).toEqual({ ...EMPTY_ROLE_FILTERS, title: "admin" })
  })

  it("clears one logical filter by key", () => {
    expect(
      clearRoleFilter(
        { ...EMPTY_ROLE_FILTERS, title: "admin", status: "active" },
        "status"
      )
    ).toEqual({ ...EMPTY_ROLE_FILTERS, title: "admin" })
  })
})

describe("roleFilterChips", () => {
  const t = (key: string, options?: Record<string, unknown>) =>
    String(options?.value ?? options?.date ?? key)
  const statusOptions = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ]

  it("derives chips in descriptor order using option labels", () => {
    expect(
      roleFilterChips(
        {
          ...EMPTY_ROLE_FILTERS,
          title: "admin",
          status: "active,inactive",
          createdAtFrom: "2026-01-02",
        },
        { t, statusOptions }
      )
    ).toEqual([
      { key: "title", label: "admin" },
      { key: "status", label: "Active, Inactive" },
      { key: "createdAt", label: "2026-01-02" },
    ])
  })

  it("returns no chips for empty values", () => {
    expect(roleFilterChips(EMPTY_ROLE_FILTERS, { t, statusOptions })).toEqual(
      []
    )
  })
})
