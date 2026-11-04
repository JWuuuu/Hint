/**
 * A file from `public/`, addressed under the deployed base path.
 * GitHub Pages serves the app under /Hint/, so a root path such as /brand/x.png
 * would point outside the site. Root deployments and native builds use /.
 */
// Node imports this module too (the e2e specs read card paths), where Vite's env is absent.
const BUILD_BASE: string = import.meta.env?.BASE_URL ?? "/";

export function publicAsset(path: string, base: string = BUILD_BASE): string {
  return `${base.replace(/\/*$/, "/")}${path.replace(/^\/+/, "")}`;
}
