/**
 * A file from `public/`, addressed under the deployed base path.
 * GitHub Pages serves the app under /Hint/, so a root path such as /brand/x.png
 * would point outside the site. Root deployments and native builds use /.
 */
export function publicAsset(path: string, base: string = import.meta.env.BASE_URL): string {
  return `${base.replace(/\/*$/, "/")}${path.replace(/^\/+/, "")}`;
}
