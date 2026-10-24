import { serializeGeometry } from './geometry';
import { createBufferGeometryFromData } from './geometry';
import type {
  BooleanOperation,
  CsgResultPayload,
  SerializedGeometry,
  WorkerErrorPayload,
} from '../types';
import type { BufferGeometry } from 'three';

interface PendingRequest {
  resolve: (payload: CsgResultPayload) => void;
  reject: (error: CsgWorkerError) => void;
  timer: number;
}

export class CsgWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CsgWorkerError';
    this.code = code;
  }
}

type Response =
  | { type: 'result'; id: number; payload: CsgResultPayload }
  | { type: 'error'; id: number; error: WorkerErrorPayload };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, PendingRequest>();

function disposeWorkerWithError(error: CsgWorkerError): void {
  for (const request of pending.values()) {
    window.clearTimeout(request.timer);
    request.reject(error);
  }
  pending.clear();
  worker?.terminate();
  worker = null;
}

function ensureWorker(): Worker {
  if (worker) return worker;

  worker = new Worker(new URL('../workers/csg.worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.onmessage = (event: MessageEvent<Response>) => {
    const response = event.data;
    if (!response || typeof response.id !== 'number') return;
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    window.clearTimeout(request.timer);

    if (response.type === 'result') {
      request.resolve(response.payload);
    } else {
      request.reject(new CsgWorkerError(response.error.code, response.error.message));
    }
  };

  worker.onerror = (event) => {
    console.error('[csg-worker-client]', event);
    disposeWorkerWithError(
      new CsgWorkerError('WORKER_ERROR', '布尔运算线程意外退出，请重试。'),
    );
  };

  return worker;
}

export interface RunCsgOptions {
  operation: BooleanOperation;
  a: BufferGeometry;
  b: BufferGeometry;
}

function transferListForData(data: SerializedGeometry): Transferable[] {
  const transfer: Transferable[] = [data.positions.buffer];
  if (data.normals) transfer.push(data.normals.buffer);
  if (data.indices) transfer.push(data.indices.buffer);
  return transfer;
}

export function runCsgInWorker({ operation, a, b }: RunCsgOptions): Promise<CsgResultPayload> {
  const activeWorker = ensureWorker();
  const id = nextId;
  nextId += 1;

  const dataA = serializeGeometry(a);
  const dataB = serializeGeometry(b);

  return new Promise<CsgResultPayload>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      disposeWorkerWithError(
        new CsgWorkerError(
          'WORKER_ERROR',
          '布尔运算超时（>90 秒）。请减少网格面数或降低隐式方程精度。',
        ),
      );
    }, 90_000);

    pending.set(id, { resolve, reject, timer });

    try {
      activeWorker.postMessage(
        { id, operation, a: dataA, b: dataB },
        [...transferListForData(dataA), ...transferListForData(dataB)],
      );
    } catch (error) {
      pending.delete(id);
      window.clearTimeout(timer);
      reject(
        new CsgWorkerError(
          'WORKER_ERROR',
          error instanceof Error ? `无法提交运算任务：${error.message}` : '无法提交布尔运算任务。',
        ),
      );
    }
  });
}

export function geometryFromCsgResult(payload: CsgResultPayload): BufferGeometry {
  return createBufferGeometryFromData(payload.positions, payload.normals, payload.indices);
}
