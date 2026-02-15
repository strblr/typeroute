export const stringifySearch = (search: Record<string, unknown>) => {
  return Object.entries(search)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(toValueString(value))}`)
    .join("&");
};

export const parseSearch = (search: string): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  new URLSearchParams(search).forEach((value, key) => {
    out[key] = isJSONString(value) ? JSON.parse(value) : value;
  });
  return out;
};

const toValueString = (value: unknown) => {
  return typeof value === "string" && !isJSONString(value)
    ? value
    : JSON.stringify(value);
};

const isJSONString = (value: string) => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};
