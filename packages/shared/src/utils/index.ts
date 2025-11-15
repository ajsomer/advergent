export function toCamel<T extends Record<string, any>>(input: T) {
  const result: Record<string, any> = {};
  Object.keys(input).forEach((key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = input[key];
  });
  return result as T;
}
