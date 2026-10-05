import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QueueTable } from './QueueTable';
import type { OrderAction, QueueOrder } from '../types';

function makeOrder(overrides: Partial<QueueOrder>): QueueOrder {
  return {
    id: 1,
    customer_name: 'Test Customer',
    type: 'dine_in',
    is_vip: false,
    status: 'received',
    placed_at: '2026-06-15T11:30:00.000Z',
    promised_at: null,
    items: [{ menu_item_id: 1, name: 'Caesar Salad', quantity: 1 }],
    score: 30,
    minutes_waiting: 30,
    allowed_actions: ['start', 'cancel'],
    ...overrides,
  };
}

function renderTable(orders: QueueOrder[], pendingOrderId: number | null = null) {
  const onAction = vi.fn<(orderId: number, action: OrderAction) => void>();
  render(<QueueTable orders={orders} pendingOrderId={pendingOrderId} onAction={onAction} />);
  return { onAction };
}

const row = (id: number) => screen.getByTestId(`order-row-${id}`);
const buttonNames = (id: number) =>
  within(row(id))
    .queryAllByRole('button')
    .map((button) => button.textContent);

describe('QueueTable', () => {
  it('renders rows in the order the API returned them, without re-sorting', () => {
    // Deliberately not sorted by score or id.
    renderTable([
      makeOrder({ id: 3, customer_name: 'Low', score: 20 }),
      makeOrder({ id: 1, customer_name: 'High', score: 75 }),
      makeOrder({ id: 2, customer_name: 'Mid', score: 55 }),
    ]);

    const rows = screen.getAllByTestId(/^order-row-/);
    expect(rows.map((r) => r.getAttribute('data-testid'))).toEqual([
      'order-row-3',
      'order-row-1',
      'order-row-2',
    ]);
    expect(rows.map((r) => within(r).getAllByRole('cell')[0].textContent)).toEqual(['20', '75', '55']);
  });

  it('renders only the actions the API allows for each order', () => {
    renderTable([
      makeOrder({ id: 1, status: 'received', allowed_actions: ['start', 'cancel'] }),
      makeOrder({ id: 2, status: 'preparing', allowed_actions: ['ready'] }),
      makeOrder({ id: 3, status: 'ready', allowed_actions: ['pickup'] }),
      makeOrder({ id: 4, status: 'picked_up', allowed_actions: [] }),
    ]);

    expect(buttonNames(1)).toEqual(['Start', 'Cancel']);
    expect(buttonNames(2)).toEqual(['Ready']);
    expect(buttonNames(3)).toEqual(['Picked up']);
    expect(buttonNames(4)).toEqual([]);
  });

  it.each<[string, OrderAction]>([
    ['Start', 'start'],
    ['Cancel', 'cancel'],
    ['Ready', 'ready'],
    ['Picked up', 'pickup'],
  ])('clicking %s calls onAction(order.id, %j)', async (label, action) => {
    const user = userEvent.setup();
    const { onAction } = renderTable([
      makeOrder({ id: 1, allowed_actions: ['start', 'cancel'] }),
      makeOrder({ id: 7, allowed_actions: [action] }),
    ]);

    await user.click(within(row(7)).getByRole('button', { name: label }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith(7, action);
  });

  it('disables every action while a mutation is pending', () => {
    renderTable(
      [
        makeOrder({ id: 1, allowed_actions: ['start', 'cancel'] }),
        makeOrder({ id: 2, status: 'preparing', allowed_actions: ['ready'] }),
      ],
      1,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(button).toBeDisabled();
  });

  it('enables actions when nothing is pending', () => {
    renderTable([makeOrder({ id: 1, allowed_actions: ['start', 'cancel'] })]);

    for (const button of screen.getAllByRole('button')) expect(button).toBeEnabled();
  });
});
