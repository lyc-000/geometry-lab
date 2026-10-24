import { generateImplicitMesh, ImplicitGenerationError } from '../lib/implicit-core';
import { EquationError } from '../lib/relation';
import type { ImplicitGenerationRequest } from '../lib/implicit-core';
import type { ImplicitMeshPayload, Vec3, WorkerErrorPayload } from '../types';

type Request = {
  id: number;
  expression: string;
  resolution: number;
  domain: [Vec3, Vec3];
};

type Response =
  | { type: 'result'; id: number; payload: ImplicitMeshPayload }
  | { type: 'error'; id: number; error: WorkerErrorPayload };

const workerScope = self as unknown as {
  postMessage: (message: Response, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<Request>) => void) | null;
};

workerScope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  if (!request || typeof request.id !== 'number') return;

  try {
    const payload = generateImplicitMesh({
      expression: request.expression,
      resolution: request.resolution,
      domain: request.domain,
    } satisfies ImplicitGenerationRequest);
    workerScope.postMessage(
      { type: 'result', id: request.id, payload },
      [payload.positions.buffer, payload.normals.buffer, payload.indices.buffer],
    );
  } catch (error) {
    const known = error instanceof ImplicitGenerationError || error instanceof EquationError;
    const payload: WorkerErrorPayload = known
      ? { code: (error as EquationError).code, message: error.message }
      : {
          code: 'UNKNOWN',
          message:
            error instanceof Error
              ? `等值面生成失败：${error.message}`
              : '等值面生成失败，请检查方程与采样范围。',
        };
    console.error('[implicit-worker]', error);
    workerScope.postMessage({ type: 'error', id: request.id, error: payload });
  }
};
