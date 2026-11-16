import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
} from "../src/routes/route-metadata"

/**
 * The checked-in preview image is a real 1200×630 PNG. Parse the IHDR header
 * rather than trusting the file extension, and keep the declared meta
 * dimensions in sync with the artifact.
 */
const png = readFileSync(new URL("../public/og-image.png", import.meta.url))
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe("social preview image", () => {
  it("is a valid PNG", () => {
    expect(Array.from(png.subarray(0, 8))).toEqual(PNG_SIGNATURE)
    expect(String.fromCharCode(...png.subarray(12, 16))).toBe("IHDR")
  })

  it("is 1200x630, matching the dimensions declared in the head", () => {
    const width = png.readUInt32BE(16)
    const height = png.readUInt32BE(20)

    expect([width, height]).toEqual([1200, 630])
    expect(width).toBe(OG_IMAGE_WIDTH)
    expect(height).toBe(OG_IMAGE_HEIGHT)
  })
})
