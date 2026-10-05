import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type { OrderAction, OrderStatus, OrderType, QueueOrder } from '../types';

// Display labels only. Which actions exist for an order comes from the API.
const ACTION_LABELS: Record<OrderAction, string> = {
  start: 'Start',
  ready: 'Ready',
  pickup: 'Picked up',
  cancel: 'Cancel',
};

const TYPE_LABELS: Record<OrderType, string> = {
  dine_in: 'Dine-in',
  takeout: 'Takeout',
  delivery: 'Delivery',
};

const STATUS_COLORS: Record<OrderStatus, 'default' | 'info' | 'success'> = {
  received: 'default',
  preparing: 'info',
  ready: 'success',
  picked_up: 'default',
  cancelled: 'default',
};

const COLUMNS = ['Score', 'Customer', 'Type', 'Items', 'Waiting', 'Promised', 'VIP', 'Status', 'Actions'];

function itemsSummary(order: QueueOrder): string {
  return order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ');
}

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  orders: QueueOrder[];
  pendingOrderId: number | null;
  onAction: (orderId: number, action: OrderAction) => void;
}

export function QueueTable({ orders, pendingOrderId, onAction }: Props) {
  return (
    <TableContainer>
      <Table size="small" stickyHeader aria-label="Order queue">
        <TableHead>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableCell key={column} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                {column}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4 }}>
                <Typography color="text.secondary">No orders in the queue.</Typography>
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.id} hover data-testid={`order-row-${order.id}`}>
                <TableCell sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {order.score}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {order.customer_name}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    #{order.id}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{TYPE_LABELS[order.type]}</TableCell>
                <TableCell>{itemsSummary(order)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {order.minutes_waiting} min
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(order.promised_at)}
                </TableCell>
                <TableCell>
                  {order.is_vip && <Chip label="VIP" size="small" color="warning" />}
                </TableCell>
                <TableCell>
                  <Chip label={order.status} size="small" color={STATUS_COLORS[order.status]} variant="outlined" />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    {order.allowed_actions.map((action) => (
                      <Button
                        key={action}
                        size="small"
                        variant={action === 'cancel' ? 'outlined' : 'contained'}
                        color={action === 'cancel' ? 'error' : 'primary'}
                        disabled={pendingOrderId !== null}
                        onClick={() => onAction(order.id, action)}
                        sx={{ py: 0, minWidth: 0, whiteSpace: 'nowrap' }}
                      >
                        {ACTION_LABELS[action]}
                      </Button>
                    ))}
                  </Stack>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
