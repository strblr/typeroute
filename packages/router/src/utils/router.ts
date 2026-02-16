import { normalizePath } from "./route";
import { parseSearch, stringifySearch } from "./search";
import type { Route } from "../route";
import type { Match } from "../types";

export const absolutePath = (rpath: string, basePath: string) => {
  return normalizePath(`${basePath}/${rpath}`);
};

export const relativePath = (path: string, basePath: string) => {
  if (path === basePath || path.startsWith(`${basePath}/`)) {
    path = path.slice(basePath.length) || "/";
  }
  return path;
};

export const mergeUrl = (path: string, search: Record<string, unknown>) => {
  return [path, stringifySearch(search)].filter(Boolean).join("?");
};

export const parseUrl = (url: string) => {
  const { pathname, search } = new URL(url, "http://w");
  return { path: pathname, search: parseSearch(search) };
};

export const match = (
  { keys, regex, loose }: Route["_"],
  strict: boolean | undefined,
  path: string,
  basePath: string
) => {
  const matches = (strict ? regex : loose).exec(relativePath(path, basePath));
  if (!matches) return null;
  const out: Record<string, string> = {};
  keys.forEach((key, i) => {
    const match = matches[i + 1];
    match && (out[key] = match);
  });
  return out;
};

export const rankMatches = (matches: Match[]) => {
  return [...matches].sort((a, b) =>
    b.route._.weight.localeCompare(a.route._.weight)
  );
};
