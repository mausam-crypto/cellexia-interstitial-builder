import { describe, it, expect } from "vitest";
import { normalizeResolution, literalFixFrom422, normalizeAspectRatio } from "../app/lib/integrations/higgsfield.server";

describe("Higgsfield request building", () => {
  it("sends a Soul resolution the API accepts (720p | 1080p) and maps legacy values", () => {
    expect(normalizeResolution(undefined)).toBe("1080p");
    expect(normalizeResolution("")).toBe("1080p");
    expect(normalizeResolution("1080p")).toBe("1080p");
    expect(normalizeResolution("720p")).toBe("720p");
    expect(normalizeResolution("2K")).toBe("1080p");
    expect(normalizeResolution("1K")).toBe("720p");
    expect(normalizeResolution("whatever")).toBe("1080p");
  });
  it("derives a retry fix from the API's 422 literal error (the exact payload seen on 2026-08-17)", () => {
    const body = [{ type: "literal_error", loc: ["body", "resolution"], msg: "Input should be '720p' or '1080p'", input: "2K", ctx: { expected: "'720p' or '1080p'" } }];
    expect(literalFixFrom422(body)).toEqual({ resolution: "720p" });
    expect(literalFixFrom422({ detail: body })).toEqual({ resolution: "720p" });
    expect(literalFixFrom422({ detail: "Unauthorized" })).toBeNull();
    expect(literalFixFrom422([{ type: "missing", loc: ["body", "prompt"], msg: "Field required" }])).toBeNull();
  });
  it("snaps aspect ratios to the supported set", () => {
    expect(normalizeAspectRatio("4:3")).toBe("4:3");
    expect(normalizeAspectRatio("1200x675")).toBe("16:9");
    expect(normalizeAspectRatio("1/1")).toBe("1:1");
  });
});
