import type { Value } from './types';
export function isValue(value: unknown): value is Value {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}
// A null initial value declares an unset flag that may later hold a scalar.
export function compatibleValue(value: unknown, initial: Value): value is Value {
  return isValue(value) && (initial === null || typeof value === typeof initial && value !== null);
}
