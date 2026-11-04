import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { publicAsset } from "./publicAsset";

describe("publicAsset", () => {
  it("keeps root deployments unchanged", () => {
    expect(publicAsset("/brand/hint-card-logo.png", "/")).toBe("/brand/hint-card-logo.png");
    expect(publicAsset("lucky/food/tacos.png", "/")).toBe("/lucky/food/tacos.png");
  });

  it("places files under a sub-path deployment such as GitHub Pages", () => {
    expect(publicAsset("/brand/tarot/cards/19-TheSun.jpg?v=1", "/Hint/")).toBe("/Hint/brand/tarot/cards/19-TheSun.jpg?v=1");
    expect(publicAsset("brand/tarot/card-backs", "/Hint")).toBe("/Hint/brand/tarot/card-backs");
  });

  it("uses the build's base by default", () => {
    expect(publicAsset("/personalities/personality-icons-simple.png")).toBe(`${import.meta.env.BASE_URL}personalities/personality-icons-simple.png`);
  });

  it("app code never hard-codes a root path into public/, which would break under /Hint/", () => {
    // CSS url() is rewritten by Vite with the base, so only script sources are checked.
    const root = process.cwd();
    const folders = readdirSync(resolve(root, "public")).filter(name => statSync(resolve(root, "public", name)).isDirectory());
    const pattern = new RegExp(`["'\`(]/(?:${folders.join("|")})/[^"'\`)\\s]*`, "g");
    const offenders: string[] = [];
    const scan = (directory: string) => {
      for (const entry of readdirSync(directory)) {
        const file = join(directory, entry);
        if (statSync(file).isDirectory()) scan(file);
        else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
          for (const match of readFileSync(file, "utf8").matchAll(pattern)) offenders.push(`${file.slice(root.length + 1)}: ${match[0]}`);
        }
      }
    };
    scan(resolve(root, "src"));
    expect(folders).toContain("brand");
    expect(offenders, "Wrap these with publicAsset()").toEqual([]);
  });
});
