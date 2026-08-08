import { SectionBox } from '@kinvolk/headlamp-plugin/lib/components/common';
import { Alert, Box, Chip, Divider, Stack, Tooltip, Typography } from '@mui/material';
import {
  buildTimeline,
  type CollapsedTimelineEvent,
  collapseRepeats,
  deriveLifecycleState,
  type LifecyclePhase,
  type LifecycleState,
  type WorkloadStatusLike,
} from '../../resources/workloadLifecycle';

/** The four phases, in the order Kueue moves through them. */
const PHASES: LifecyclePhase[] = ['Queueing', 'Admission', 'Execution', 'Completion'];

/**
 * Stages that mean the Workload is stuck rather than progressing. Used to
 * colour the rail, and always paired with text so colour is never the only
 * signal.
 */
const STUCK_STAGES = new Set(['Inadmissible', 'Blocked', 'Evicted', 'Deactivated']);

function phaseState(
  phase: LifecyclePhase,
  current: LifecycleState
): 'done' | 'current' | 'stuck' | 'upcoming' {
  const currentIndex = PHASES.indexOf(current.phase);
  const index = PHASES.indexOf(phase);

  if (index < currentIndex) {
    return 'done';
  }
  if (index > currentIndex) {
    return 'upcoming';
  }
  return STUCK_STAGES.has(current.stage) ? 'stuck' : 'current';
}

const RAIL_COLORS = {
  done: 'success.main',
  current: 'info.main',
  stuck: 'warning.main',
  upcoming: 'divider',
} as const;

/**
 * The four-segment progress rail.
 *
 * Each segment carries its own state word, so the rail is readable without
 * colour. A screen reader gets the whole thing as one sentence rather than
 * four disconnected labels.
 */
function StageRail({ state }: { state: LifecycleState }) {
  const summary = PHASES.map(phase => `${phase} ${phaseState(phase, state)}`).join(', ');

  return (
    <Box role="group" aria-label={`Workload lifecycle: ${summary}`}>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        {PHASES.map(phase => {
          const status = phaseState(phase, state);

          return (
            <Box key={phase} sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: RAIL_COLORS[status],
                  mb: 0.5,
                }}
              />
              <Typography
                variant="caption"
                noWrap
                sx={{ fontWeight: status === 'current' || status === 'stuck' ? 600 : 400 }}
                color={status === 'upcoming' ? 'text.disabled' : 'text.primary'}
              >
                {phase}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

/** One row of the timeline. */
function TimelineRow({ event }: { event: CollapsedTimelineEvent }) {
  const color =
    event.severity === 'error'
      ? 'error.main'
      : event.severity === 'warning'
      ? 'warning.main'
      : 'text.secondary';

  return (
    <Box display="flex" gap={1.5} alignItems="flex-start">
      <Box
        sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, mt: '6px', flexShrink: 0 }}
      />
      <Box sx={{ minWidth: 0 }}>
        <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
          <Typography variant="body2" color={color} sx={{ fontWeight: 500 }}>
            {event.label}
          </Typography>
          {event.count > 1 && (
            <Tooltip title={`Last occurrence ${event.lastAt}`}>
              <Chip label={`x${event.count}`} size="small" variant="outlined" />
            </Tooltip>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary">
          {event.at}
          {event.count > 1 ? ` to ${event.lastAt}` : ''}
        </Typography>
        {event.detail && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {event.detail}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

/**
 * Answers "where is this Workload and what is holding it up" from the
 * status alone.
 *
 * Kueue's conditions are complete but not readable in bulk, which is the
 * problem this exists to solve. Everything shown here is derived by the pure
 * functions in `workloadLifecycle.ts`, so the derivation is unit tested and
 * this component only lays it out.
 */
export default function LifecycleSection({ status }: { status: WorkloadStatusLike | undefined }) {
  const state = deriveLifecycleState(status?.conditions, status?.admissionChecks);
  const events = collapseRepeats(buildTimeline(status));
  const stuck = STUCK_STAGES.has(state.stage);

  return (
    <SectionBox title="Lifecycle">
      <StageRail state={state} />

      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap" sx={{ mt: 1.5, mb: 1 }}>
        <Chip
          label={state.stage}
          size="small"
          color={stuck ? 'warning' : state.isTerminal ? 'default' : 'info'}
        />
        {state.reason && (
          <Typography variant="body2" color="text.secondary">
            {state.reason}
          </Typography>
        )}
        {state.derivedFrom && (
          <Tooltip title="The status field this stage was derived from">
            <Typography variant="caption" color="text.disabled">
              via {state.derivedFrom}
            </Typography>
          </Tooltip>
        )}
      </Box>

      {state.message && (
        <Alert severity={stuck ? 'warning' : 'info'} sx={{ mb: 1.5 }}>
          {state.message}
        </Alert>
      )}

      <Divider sx={{ my: 1.5 }} />

      {events.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No transitions recorded yet.
        </Typography>
      ) : (
        <Stack spacing={1.25}>
          {events.map((event, index) => (
            <TimelineRow key={`${event.label}-${event.at}-${index}`} event={event} />
          ))}
        </Stack>
      )}
    </SectionBox>
  );
}
