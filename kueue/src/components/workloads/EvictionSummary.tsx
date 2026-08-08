import { SectionBox, SimpleTable } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Box, Typography } from '@mui/material';
import {
  describeEviction,
  type EvictionStatLike,
  totalEvictions,
} from '../../resources/workloadLifecycle';

interface EvictionRow {
  cause: string;
  reason: string;
  underlyingCause: string;
  count: number;
  share: number;
}

/**
 * Eviction history from `status.schedulingStats.evictions`.
 *
 * Kueue already aggregates these by reason and underlying cause and gives a
 * count, so nothing is recomputed here beyond the total and each row's share.
 * The bar is drawn with plain boxes rather than a chart library: there are at
 * most a handful of reasons and they are already sorted by importance once
 * ordered by count, so a charting dependency would buy nothing.
 */
export default function EvictionSummary({ evictions = [] }: { evictions?: EvictionStatLike[] }) {
  const total = totalEvictions(evictions);

  if (total === 0) {
    return null;
  }

  const rows: EvictionRow[] = [...evictions]
    .sort((a, b) => b.count - a.count)
    .map(eviction => ({
      cause: describeEviction(eviction),
      reason: eviction.reason,
      underlyingCause: eviction.underlyingCause || '-',
      count: eviction.count,
      share: eviction.count / total,
    }));

  return (
    <SectionBox title={`Evictions (${total})`}>
      <Box sx={{ mb: 2 }}>
        {rows.map(row => (
          <Box key={row.cause} sx={{ mb: 1 }}>
            <Box display="flex" justifyContent="space-between" gap={2}>
              <Typography variant="body2" noWrap>
                {row.cause}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {row.count}
              </Typography>
            </Box>
            <Box
              role="img"
              aria-label={`${row.cause}: ${row.count} of ${total} evictions`}
              sx={{ height: 6, borderRadius: 3, bgcolor: 'divider', mt: 0.5 }}
            >
              <Box
                sx={{
                  width: `${Math.round(row.share * 100)}%`,
                  height: '100%',
                  borderRadius: 3,
                  bgcolor: 'warning.main',
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>

      <SimpleTable
        columns={[
          { label: 'Reason', getter: (row: EvictionRow) => row.reason },
          { label: 'Underlying cause', getter: (row: EvictionRow) => row.underlyingCause },
          { label: 'Count', getter: (row: EvictionRow) => row.count },
        ]}
        data={rows}
      />
    </SectionBox>
  );
}
