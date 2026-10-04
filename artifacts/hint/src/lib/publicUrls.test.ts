import { afterEach, describe, expect, it, vi } from "vitest";
import { hintDownloadUrl, parseHintUniversalLink, publicAppUrl, validatePublicUrl } from "./publicUrls";
afterEach(() => vi.unstubAllEnvs());
describe("release public links", () => {
  it.each(["http://mydailyhint.com", "https://localhost/app", "https://127.0.0.1/app", "capacitor://localhost", "https://api.example.com", "https://hint.test", "https://user:secret@mydailyhint.com", "https://mydailyhint.com/?token=secret", "https://your-domain.com"])("rejects unsafe or placeholder address %s", value => {
    expect(() => validatePublicUrl(value)).toThrow();
  });
  it("retains a configured hosting subpath for invitations and receipt links", () => {
    vi.stubEnv("VITE_HINT_PUBLIC_URL", "https://mydailyhint.com/Hint/");
    expect(publicAppUrl("/app/compatibility/invite/abcdefghijklmnop")).toBe("https://mydailyhint.com/Hint/app/compatibility/invite/abcdefghijklmnop");
    vi.stubEnv("VITE_HINT_DOWNLOAD_URL", "https://mydailyhint.com/download");
    expect(hintDownloadUrl()).toBe("https://mydailyhint.com/download");
  });
  it("only opens the exact configured host and valid invitation routes", () => {
    const base = "https://mydailyhint.com/Hint";
    const route = "/app/compatibility/invite/abcdefghijklmnop";
    expect(parseHintUniversalLink(base + route, base)).toBe(route);
    for (const url of ["https://evil.com/Hint" + route, base + route + "?next=https://evil.com", base + "/app/profile", base + route + "/../../profile", base + "/app/compatibility/invite/%2Fbad"]) {
      expect(parseHintUniversalLink(url, base)).toBeNull();
    }
  });
});
