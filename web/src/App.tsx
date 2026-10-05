import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { QueueFilterToggle } from './components/QueueFilterToggle';
import { QueueTable } from './components/QueueTable';
import { useQueue } from './useQueue';
import type { QueueFilter } from './types';

export default function App() {
  const [filter, setFilter] = useState<QueueFilter>('active');
  const { orders, loading, error, pendingOrderId, reload, runAction, clearError } = useQueue(filter);

  return (
    <Box component="main" sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 1.5, alignItems: 'center' }}>
        <Typography variant="h6" component="h1" sx={{ flexGrow: 1 }}>
          Kitchen Display
        </Typography>
        <QueueFilterToggle
          value={filter}
          onChange={(next) => {
            // An error from the previous view no longer applies.
            clearError();
            setFilter(next);
          }}
        />
        <Button size="small" variant="outlined" onClick={() => void reload()} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" onClose={clearError} sx={{ mb: 1.5 }} role="alert">
          <strong>{error.code}</strong>: {error.message}
        </Alert>
      )}

      <Paper variant="outlined">
        <Box sx={{ height: 4 }}>{loading && <LinearProgress />}</Box>
        <QueueTable
          orders={orders}
          pendingOrderId={pendingOrderId}
          onAction={(orderId, action) => void runAction(orderId, action)}
        />
      </Paper>
    </Box>
  );
}
