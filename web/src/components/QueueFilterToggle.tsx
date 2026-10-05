import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import type { QueueFilter } from '../types';

const OPTIONS: Array<{ value: QueueFilter; label: string }> = [
  { value: 'active', label: 'Active queue' },
  { value: 'received', label: 'Received' },
  { value: 'preparing', label: 'Preparing' },
];

interface Props {
  value: QueueFilter;
  onChange: (value: QueueFilter) => void;
}

export function QueueFilterToggle({ value, onChange }: Props) {
  return (
    <ToggleButtonGroup
      size="small"
      exclusive
      value={value}
      // Clicking the selected option passes null; keep the current filter.
      onChange={(_event, next: QueueFilter | null) => next && onChange(next)}
      aria-label="Queue filter"
    >
      {OPTIONS.map((option) => (
        <ToggleButton key={option.value} value={option.value} sx={{ px: 1.5, py: 0.25 }}>
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
