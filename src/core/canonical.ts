import { createHash } from 'node:crypto';

const CANONICAL_VALUE_ERROR = 'unsupported canonical value';

type CanonicalValue = null | boolean | number | string | CanonicalValue[] | CanonicalRecord;
interface CanonicalRecord {
  [key: string]: CanonicalValue;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(requireCanonicalValue(value));
}

export function assertCanonicalValue(value: unknown): void {
  requireCanonicalValue(value);
}

export function sha256Canonical(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function isCanonicalValue(value: unknown): boolean {
  try {
    assertCanonicalValue(value);
    return true;
  } catch {
    return false;
  }
}

export function ownDataValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.enumerable === true && 'value' in (descriptor ?? {}) ? descriptor.value : undefined;
}

function requireCanonicalValue(value: unknown): CanonicalValue {
  try {
    return canonicalize(value, new Set<object>());
  } catch {
    throw new Error(CANONICAL_VALUE_ERROR);
  }
}

function canonicalize(value: unknown, ancestors: Set<object>): CanonicalValue {
  if (isJsonPrimitive(value)) return value;
  if (typeof value !== 'object' || value === null || ancestors.has(value)) throw new Error(CANONICAL_VALUE_ERROR);
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return canonicalizeArray(value, ancestors);
    if (isPlainRecord(value)) return canonicalizeRecord(value, ancestors);
    throw new Error(CANONICAL_VALUE_ERROR);
  } finally {
    ancestors.delete(value);
  }
}

function isJsonPrimitive(value: unknown): value is null | boolean | number | string {
  return value === null || typeof value === 'boolean' || typeof value === 'string'
    || (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0));
}

function canonicalizeArray(array: readonly unknown[], ancestors: Set<object>): CanonicalValue[] {
  if (!hasNormalArrayProperties(array)) throw new Error(CANONICAL_VALUE_ERROR);
  const result: CanonicalValue[] = [];
  for (let index = 0; index < array.length; index += 1) result.push(canonicalize(array[index], ancestors));
  return result;
}

function hasNormalArrayProperties(array: readonly unknown[]): boolean {
  if (Object.getPrototypeOf(array) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(array);
  if (keys.length !== array.length + 1 || keys.some((key) => typeof key === 'symbol')) return false;
  for (let index = 0; index < array.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(array, String(index));
    if (descriptor?.enumerable !== true || !('value' in descriptor)) return false;
  }
  return keys.every((key) => key === 'length' || (typeof key === 'string' && isArrayIndex(key, array.length)));
}

function isArrayIndex(key: string, length: number): boolean {
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < length && String(index) === key;
}

function canonicalizeRecord(record: Readonly<Record<string, unknown>>, ancestors: Set<object>): CanonicalRecord {
  const keys = Reflect.ownKeys(record);
  if (!hasNormalRecordProperties(record, keys)) throw new Error(CANONICAL_VALUE_ERROR);
  const result = Object.create(null) as CanonicalRecord;
  for (const key of keys.sort()) result[key] = canonicalizeRecordValue(record, key, ancestors);
  return result;
}

function hasNormalRecordProperties(record: Readonly<Record<string, unknown>>, keys: readonly PropertyKey[]): keys is string[] {
  return keys.every((key) => typeof key === 'string' && isEnumerableDataProperty(record, key));
}

function isEnumerableDataProperty(record: Readonly<Record<string, unknown>>, key: string): boolean {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor?.enumerable === true && 'value' in (descriptor ?? {});
}

function canonicalizeRecordValue(record: Readonly<Record<string, unknown>>, key: string, ancestors: Set<object>): CanonicalValue {
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || descriptor.enumerable !== true || !('value' in descriptor)) throw new Error(CANONICAL_VALUE_ERROR);
  return canonicalize(descriptor.value, ancestors);
}

function isPlainRecord(value: object): value is Readonly<Record<string, unknown>> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
