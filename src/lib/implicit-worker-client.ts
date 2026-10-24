import type { ImplicitGenerationRequest } from './implicit-core';
import type { ImplicitMeshPayload, Vec3, WorkerErrorPayload } from '../types';

interface PendingRequest {
  resolve: (payload: ImplicitMeshPayload) => void;
  reject: (error: ImplicitWorkerError) => void;
  timer: number;
}

export class ImplicitWorkerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ImplicitWorkerError';
    this.code = code;
  }
}

type Response =
  | { type: 'result'; id: number; payload: ImplicitMeshPayload }
  | { type: 'error'; id: number; error: WorkerErrorPayload };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, PendingRequest>();

function disposeWorkerWithError(error: ImplicitWorkerError): void {
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

  worker = new Worker(new URL('../workers/implicit.worker.ts', import.meta.url), {
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
      request.reject(new ImplicitWorkerError(response.error.code, response.error.message));
    }
  };

  worker.onerror = (event) => {
    console.error('[implicit-worker-client]', event);
    disposeWorkerWithError(
      new ImplicitWorkerError('WORKER_ERROR', '等值面计算线程意外退出，请重试。'),
    );
  };

  return worker;
}

export function generateImplicitMeshInWorker(
  request: ImplicitGenerationRequest,
): Promise<ImplicitMeshPayload> {
  const activeWorker = ensureWorker();
  const id = nextId;
  nextId += 1;

  return new Promise<ImplicitMeshPayload>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      disposeWorkerWithError(
        new ImplicitWorkerError(
          'WORKER_ERROR',
          '等值面计算超时（>90 秒）。请降低采样精度或缩小采样范围。',
        ),
      );
    }, 90_000);

    pending.set(id, { resolve, reject, timer });
    activeWorker.postMessage({
      id,
      expression: request.expression,
      resolution: request.resolution,
      domain: request.domain as [Vec3, Vec3],
    });
  });
}
