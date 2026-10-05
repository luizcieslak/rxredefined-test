import type { OrderAction, QueueFilter, QueueOrder } from './types';

/** An error response from the API, or a failure to reach it. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the API. Is it running on port 4000?');
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const { error } = (body ?? {}) as ErrorBody;
    throw new ApiError(
      response.status,
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Request failed with status ${response.status}`,
    );
  }
  return body as T;
}

export async function fetchQueue(filter: QueueFilter, signal?: AbortSignal): Promise<QueueOrder[]> {
  const query = filter === 'active' ? '' : `?status=${filter}`;
  const { orders } = await request<{ orders: QueueOrder[] }>(`/orders/queue${query}`, { signal });
  return orders;
}

export async function applyOrderAction(id: number, action: OrderAction): Promise<void> {
  await request(`/orders/${id}/${action}`, { method: 'POST' });
}
