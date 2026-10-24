import { CsgCoreError, evaluateCsg } from '../lib/csg-core';
import type { CsgCoreRequest } from '../lib/csg-core';
import type { CsgResultPayload, WorkerErrorPayload } from '../types';

type Request = {
  id: number;
} & CsgCoreRequest;

type Response =
  | { type: 'result'; id: number; payload: CsgResultPayload }
  | { type: 'error'; id: number; error: WorkerErrorPayload };

const workerScope = self as unknown as {
  postMessage: (message: Response, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<Request>) => void) | null;
};

workerScope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  if (!request || typeof request.id !== 'number') return;

  try {
    const payload = evaluateCsg(request);
    const transfer: Transferable[] = [payload.positions.buffer];
    if (payload.normals) transfer.push(payload.normals.buffer);
    if (payload.indices) transfer.push(payload.indices.buffer);
    workerScope.postMessage({ type: 'result', id: request.id, payload }, transfer);
  } catch (error) {
    const payload: WorkerErrorPayload =
      error instanceof CsgCoreError
        ? { code: error.code, message: error.message }
        : {
            code: 'UNKNOWN',
            message:
              error instanceof Error
                ? `布尔运算失败：${error.message}`
                : '布尔运算失败，请检查实体是否封闭。',
          };
    console.error('[csg-worker]', error);
    workerScope.postMessage({ type: 'error', id: request.id, error: payload });
  }
};
