import { clsx, type ClassValue } from 'clsx';
import type { SolidKind, SolidMeta } from '../types';
import { KIND_LABELS, OPERATION_LABELS } from './colors';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function makeId(prefix = 'id'): string {
  const cryptoObject = globalThis.crypto as Crypto | undefined;
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return `${prefix}_${cryptoObject.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function nextObjectName(existingNames: string[]): string {
  const taken = new Set(existingNames);
  for (let i = 0; i < 26; i += 1) {
    const name = String.fromCharCode(65 + i);
    if (!taken.has(name)) return name;
  }
  for (let i = 1; i < 1000; i += 1) {
    const name = `A${i}`;
    if (!taken.has(name)) return name;
  }
  return `O${Date.now().toString(36).toUpperCase()}`;
}

export function describeKind(kind: SolidKind, meta: SolidMeta): string {
  if (kind === 'csg') {
    const operation = meta.operation ? OPERATION_LABELS[meta.operation] : '布尔运算';
    const sources = meta.sourceNames?.join(' / ');
    return sources ? `${operation} · ${sources}` : `${operation}结果`;
  }
  if (kind === 'clip') {
    return meta.sourceName ? `剖切 · 来自 ${meta.sourceName}` : '平面剖切实体';
  }
  return KIND_LABELS[kind];
}

export function objectCategory(kind: SolidKind): string {
  if (kind === 'sphere' || kind === 'cylinder' || kind === 'box') return '解析立体';
  if (kind === 'implicit') return '方程立体';
  if (kind === 'csg') return '布尔实体';
  return '剖切实体';
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(Math.round(value));
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits }).format(value);
}

export function formatSigned(value: number, digits = 2): string {
  if (Math.abs(value) < 10 ** (-digits) / 2) return '0';
  const fixed = value.toFixed(digits).replace(/\.?0+$/, '');
  return value > 0 ? `+${fixed}` : fixed;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function stripTrailingZeros(value: string): string {
  return value.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

export function parseNumericInput(value: string): number | null {
  const normalized = value.trim().replace(/[−–—]/g, '-');
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

export function axisTitle(axis: 'x' | 'y' | 'z'): string {
  return axis.toUpperCase();
}
