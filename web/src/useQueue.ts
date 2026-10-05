import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, applyOrderAction, fetchQueue } from './api';
import type { OrderAction, QueueFilter, QueueOrder } from './types';

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, 'UNEXPECTED_ERROR', error instanceof Error ? error.message : String(error));
}

/**
 * Loads the queue for a filter and applies actions. After every action the
 * queue is reloaded, so order and scores always come from the API.
 */
export function useQueue(filter: QueueFilter) {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<number | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  const reload = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setLoading(true);
    try {
      setOrders(await fetchQueue(filter, controller.signal));
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(toApiError(err));
    } finally {
      if (inFlight.current === controller) setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    reload();
    return () => inFlight.current?.abort();
  }, [reload]);

  const runAction = useCallback(
    async (orderId: number, action: OrderAction) => {
      setPendingOrderId(orderId);
      setError(null);
      try {
        await applyOrderAction(orderId, action);
      } catch (err) {
        setError(toApiError(err));
      }
      // Reload either way: a rejected action usually means the screen was stale.
      // The order stays pending until the reload lands, so the filter cannot
      // change between the mutation and the table catching up.
      try {
        await reload();
      } finally {
        setPendingOrderId(null);
      }
    },
    [reload],
  );

  return {
    orders,
    loading,
    error,
    pendingOrderId,
    reload,
    runAction,
    clearError: () => setError(null),
  };
}
