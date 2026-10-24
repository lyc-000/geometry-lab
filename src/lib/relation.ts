import { parse } from 'mathjs';
import type { Vec3 } from '../types';

export type Comparator = '<=' | '>=' | '<' | '>' | '=';

export class EquationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'EquationError';
    this.code = code;
  }
}

export interface ParsedRelation {
  /** The user source after light unicode normalisation. */
  source: string;
  comparator: Comparator;
  isInequality: boolean;
  /** d = insideSign * (lhs - rhs). For an equation the sign is unknown (null). */
  insideSign: 1 | -1 | null;
  raw: (x: number, y: number, z: number) => number;
  latex: string;
  lhsLatex: string;
  rhsLatex: string;
}

export interface ParsedPlane {
  source: string;
  latex: string;
  normal: Vec3;
  /** THREE.Plane convention: normal · point + constant = 0. */
  constant: number;
  /** Signed distance from the origin to the plane along the kept normal. */
  offset: number;
  point: Vec3;
  raw: (x: number, y: number, z: number) => number;
  displayEquation: string;
}

const ALLOWED_SYMBOLS = new Set([
  'x',
  'y',
  'z',
  'pi',
  'e',
  'tau',
  'phi',
]);

const ALLOWED_FUNCTIONS = new Set([
  'abs',
  'sqrt',
  'cbrt',
  'exp',
  'log',
  'log10',
  'log2',
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'pow',
  'min',
  'max',
  'floor',
  'ceil',
  'round',
  'sign',
  'hypot',
]);

const ALLOWED_OPERATORS = new Set([
  'add',
  'subtract',
  'multiply',
  'divide',
  'pow',
  'unaryMinus',
  'unaryPlus',
  'mod',
]);

const ALLOWED_NODE_TYPES = new Set([
  'ConstantNode',
  'SymbolNode',
  'OperatorNode',
  'FunctionNode',
  'ParenthesisNode',
]);

const COMPARATOR_PATTERN = /<=|>=|==|=|<|>/g;

const COMPARATOR_TEX: Record<Comparator, string> = {
  '<=': '\\le',
  '>=': '\\ge',
  '<': '<',
  '>': '>',
  '=': '=',
};

export function normalizeEquationInput(input: string): string {
  const superscripts: Record<string, string> = {
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9',
  };

  let result = input
    .replace(/[\u00a0\u3000]/g, ' ')
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/π/g, 'pi')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/（/g, '(')
    .replace(/）/g, ')');

  result = result.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (match) => {
    const digits = [...match].map((character) => superscripts[character] ?? '').join('');
    return `^${digits}`;
  });

  return result.trim();
}

function findComparator(expression: string): { comparator: Comparator; index: number; length: number } | null {
  COMPARATOR_PATTERN.lastIndex = 0;
  const matches = [...expression.matchAll(COMPARATOR_PATTERN)];
  if (matches.length > 1) {
    throw new EquationError('PARSE_ERROR', '一个输入中只能包含一个比较符（=、≤ 或 ≥）。');
  }
  if (matches.length === 0) return null;

  const match = matches[0];
  if (match.index === undefined) return null;
  const token = match[0];
  const comparator: Comparator = token === '==' ? '=' : (token as Comparator);
  return { comparator, index: match.index, length: token.length };
}

function validateNode(node: any): void {
  node.traverse((current: any) => {
    const type = current.type as string;
    if (!ALLOWED_NODE_TYPES.has(type)) {
      throw new EquationError(
        'PARSE_ERROR',
        '方程中包含不支持的语法。仅支持四则运算、乘方、绝对值、三角/指数/对数等常见函数。',
      );
    }

    if (type === 'SymbolNode') {
      const name = current.name as string;
      if (!ALLOWED_SYMBOLS.has(name) && !ALLOWED_FUNCTIONS.has(name)) {
        throw new EquationError(
          'PARSE_ERROR',
          `不支持符号「${name}」。变量仅可使用 x、y、z，常量可用 pi、e。`,
        );
      }
    }

    if (type === 'FunctionNode') {
      const name = current.fn?.name as string | undefined;
      if (!name || !ALLOWED_FUNCTIONS.has(name)) {
        throw new EquationError(
          'PARSE_ERROR',
          `不支持函数「${name ?? '未知'}」。可用函数包括 sqrt、abs、sin、cos、exp、log 等。`,
        );
      }
    }

    if (type === 'OperatorNode') {
      const operator = current.fn as string;
      if (!ALLOWED_OPERATORS.has(operator)) {
        throw new EquationError('PARSE_ERROR', `不支持运算符「${current.op ?? operator}」。`);
      }
    }

    if (type === 'ConstantNode') {
      if (typeof current.value !== 'number' || !Number.isFinite(current.value)) {
        throw new EquationError('PARSE_ERROR', '方程中仅允许有限实数常量。');
      }
    }
  });
}

function parseMathNode(source: string) {
  try {
    const node = parse(source);
    if (Array.isArray(node)) {
      throw new EquationError('PARSE_ERROR', '方程不能包含多条语句。');
    }
    if (!node) throw new EquationError('PARSE_ERROR', '方程为空。');
    validateNode(node);
    return node;
  } catch (error) {
    if (error instanceof EquationError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new EquationError(
      'PARSE_ERROR',
      `方程语法有误：${message.split('\n')[0]}`,
    );
  }
}

function compileNode(node: any): (x: number, y: number, z: number) => number {
  let compiled: any;
  try {
    compiled = node.compile();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new EquationError('PARSE_ERROR', `表达式无法编译：${message}`);
  }

  return (x: number, y: number, z: number): number => {
    let result: unknown;
    try {
      result = compiled.evaluate({ x, y, z });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new EquationError(
        'NON_FINITE',
        `方程在点 (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) 处无法求值：${message}`,
      );
    }

    if (typeof result !== 'number' || !Number.isFinite(result)) {
      throw new EquationError(
        'NON_FINITE',
        `方程在点 (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}) 处不是有限实数。请检查定义域（例如负数开方、除以零）。`,
      );
    }
    return result;
  };
}

export function parseRelation(
  input: string,
  options: { requireEquality?: boolean } = {},
): ParsedRelation {
  const source = normalizeEquationInput(input);
  if (!source) {
    throw new EquationError('PARSE_ERROR', '请输入一个方程或不等式。');
  }

  const comparatorInfo = findComparator(source);
  const comparator: Comparator = comparatorInfo?.comparator ?? '=';
  const leftSource = comparatorInfo ? source.slice(0, comparatorInfo.index).trim() : source;
  const rightSource = comparatorInfo
    ? source.slice(comparatorInfo.index + comparatorInfo.length).trim()
    : '0';

  if (!leftSource) {
    throw new EquationError('PARSE_ERROR', '比较符左侧不能为空。');
  }
  if (!rightSource) {
    throw new EquationError('PARSE_ERROR', '比较符右侧不能为空。');
  }
  if (options.requireEquality && comparator !== '=') {
    throw new EquationError('PARSE_ERROR', '平面方程必须使用等号，例如 x + y + z = 6。');
  }

  const lhsNode = parseMathNode(leftSource);
  const rhsNode = parseMathNode(rightSource);
  const lhsEvaluate = compileNode(lhsNode);
  const rhsEvaluate = compileNode(rhsNode);

  const raw = (x: number, y: number, z: number): number =>
    lhsEvaluate(x, y, z) - rhsEvaluate(x, y, z);

  const insideSign: 1 | -1 | null =
    comparator === '<=' || comparator === '<'
      ? -1
      : comparator === '>=' || comparator === '>'
        ? 1
        : null;

  const lhsLatex = lhsNode.toTex({ parenthesis: 'auto', implicit: 'hide' });
  const rhsLatex = rhsNode.toTex({ parenthesis: 'auto', implicit: 'hide' });
  const latex = `${lhsLatex} ${COMPARATOR_TEX[comparator]} ${rhsLatex}`;

  return {
    source,
    comparator,
    isInequality: comparator !== '=',
    insideSign,
    raw,
    latex,
    lhsLatex,
    rhsLatex,
  };
}

function displayNumber(value: number): string {
  if (Math.abs(value) < 1e-9) return '0';
  const fixed = value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
  return fixed;
}

export function parsePlaneEquation(input: string): ParsedPlane {
  const relation = parseRelation(input, { requireEquality: true });
  const { raw } = relation;

  const f0 = raw(0, 0, 0);
  const fx = raw(1, 0, 0) - f0;
  const fy = raw(0, 1, 0) - f0;
  const fz = raw(0, 0, 1) - f0;

  if (![f0, fx, fy, fz].every(Number.isFinite)) {
    throw new EquationError('PARSE_ERROR', '平面方程在坐标轴上无法求值。');
  }

  const coefficientScale = Math.max(1, Math.abs(f0), Math.abs(fx), Math.abs(fy), Math.abs(fz));
  const probes: Vec3[] = [
    [1, 1, 0],
    [0, 1, 1],
    [-1, 1.5, 0.5],
    [2, -1, 1],
    [3, 2, -2],
  ];
  for (const [x, y, z] of probes) {
    const actual = raw(x, y, z);
    const predicted = fx * x + fy * y + fz * z + f0;
    if (Math.abs(actual - predicted) > coefficientScale * 1e-5 + 1e-7) {
      throw new EquationError(
        'PARSE_ERROR',
        '这只支持线性平面方程（x、y、z 的一次式）。请勿加入平方项、乘积项或非线性函数。',
      );
    }
  }

  const length = Math.hypot(fx, fy, fz);
  if (length < 1e-9) {
    throw new EquationError('PARSE_ERROR', '平面方程的 x、y、z 系数不能同时为 0。');
  }

  const normal: Vec3 = [fx / length, fy / length, fz / length];
  const constant = f0 / length;
  const offset = -constant;
  const point: Vec3 = [
    normal[0] * offset,
    normal[1] * offset,
    normal[2] * offset,
  ];

  const terms: string[] = [];
  const labels = ['x', 'y', 'z'] as const;
  normal.forEach((coefficient, index) => {
    if (Math.abs(coefficient) < 1e-9) return;
    const absolute = Math.abs(coefficient);
    const magnitude = Math.abs(absolute - 1) < 1e-9 ? '' : displayNumber(absolute);
    const sign = coefficient < 0 ? '−' : '+';
    const separator = terms.length === 0 ? (coefficient < 0 ? '−' : '') : ` ${sign} `;
    terms.push(`${separator}${magnitude}${labels[index]}`);
  });
  if (terms.length === 0) terms.push('0');

  return {
    source: relation.source,
    latex: relation.latex,
    normal,
    constant,
    offset,
    point,
    raw,
    displayEquation: `${terms.join('')} = ${displayNumber(offset)}`,
  };
}

export function expressionToLatex(input: string): string {
  try {
    return parseRelation(input).latex;
  } catch {
    return '';
  }
}
