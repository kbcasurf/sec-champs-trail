import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { downloadMarkdown } from "./downloadMarkdown";

describe("downloadMarkdown", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    createObjectURLSpy = vi.fn().mockReturnValue("blob:fake-url");
    revokeObjectURLSpy = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: createObjectURLSpy, revokeObjectURL: revokeObjectURLSpy });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickSpy);
  });

  afterEach(() => vi.restoreAllMocks());

  it("creates an object URL, clicks a download link with the given filename, then revokes the URL", () => {
    downloadMarkdown("track.md", "# Content");

    expect(createObjectURLSpy).toHaveBeenCalled();
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/markdown");
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:fake-url");
  });
});
