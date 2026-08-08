/**
 * Derives a readable lifecycle from a Kueue Workload's status.
 *
 * Kueue does not store a stage. It stores conditions, and there are a lot of
 * them: `workload_types.go` defines around forty condition and reason
 * constants for this one object. Rendering them as a table answers "what
 * happened" but not "where is this and what is holding it up", which is the
 * question an operator actually has.
 *
 * Everything here is pure and takes plain data rather than a Workload
 * instance. That is deliberate twice over. It keeps this module testable,
 * since anything importing `@kinvolk/headlamp-plugin/lib/...` cannot be unit
 * tested in this repo, and it means the derivation does not depend on the
 * Workload resource class landing first.
 *
 * @see https://github.com/kubernetes-sigs/kueue/blob/main/apis/kueue/v1beta2/workload_types.go
 */

/** Kubernetes condition status values used by Workload status conditions. */
type ConditionStatus = 'True' | 'False' | 'Unknown';

/**
 * Minimal condition shape needed to derive a Workload lifecycle.
 *
 * Structural rather than imported, matching `ClusterQueueConditionLike` in
 * `clusterQueueFormatters.ts`, so this module stays free of runtime imports.
 */
export interface WorkloadConditionLike {
  /** Condition type, for example `QuotaReserved` or `Admitted`. */
  type: string;
  /** Current condition status. */
  status: ConditionStatus;
  /** Machine-readable reason reported by Kueue. Never rewritten for display. */
  reason?: string;
  /** Human-readable message reported by Kueue. */
  message?: string;
  /** RFC3339 timestamp of the last transition. */
  lastTransitionTime?: string;
}

/**
 * Per-check admission state, as it appears in `status.admissionChecks`.
 *
 * @see https://kueue.sigs.k8s.io/docs/reference/kueue.v1beta2/#admissioncheckstate
 */
export interface AdmissionCheckStateLike {
  name: string;
  /** One of Pending, Ready, Retry, Rejected. */
  state: string;
  lastTransitionTime?: string;
  message?: string;
  /** Set by a check controller when state is Retry, to space out attempts. */
  requeueAfterSeconds?: number;
}

/** Eviction counts, pre-aggregated by Kueue in `status.schedulingStats`. */
export interface EvictionStatLike {
  reason: string;
  underlyingCause?: string;
  count: number;
}

/** The subset of Workload status this module reads. */
export interface WorkloadStatusLike {
  conditions?: WorkloadConditionLike[];
  admissionChecks?: AdmissionCheckStateLike[];
  requeueState?: { count?: number; requeueAt?: string };
  schedulingStats?: { evictions?: EvictionStatLike[] };
}

/** Where a Workload is, at the granularity an operator cares about. */
export type LifecycleStage =
  | 'Pending'
  | 'Inadmissible'
  | 'Blocked'
  | 'QuotaReserved'
  | 'ChecksPending'
  | 'Admitted'
  | 'Running'
  | 'Finished'
  | 'Evicted'
  | 'Requeued'
  | 'Deactivated';

/** The four coarse phases the stage rail shows. */
export type LifecyclePhase = 'Queueing' | 'Admission' | 'Execution' | 'Completion';

export interface LifecycleState {
  stage: LifecycleStage;
  phase: LifecyclePhase;
  /** Kueue's own reason string, passed through so it matches kubectl output. */
  reason?: string;
  message?: string;
  /**
   * Which condition or admission check the stage was derived from. A wrong
   * stage should be traceable to a specific input rather than to this file.
   */
  derivedFrom?: string;
  /** True when nothing further will happen without user action. */
  isTerminal: boolean;
}

const PHASE_OF: Record<LifecycleStage, LifecyclePhase> = {
  Pending: 'Queueing',
  Inadmissible: 'Queueing',
  Blocked: 'Queueing',
  Requeued: 'Queueing',
  QuotaReserved: 'Admission',
  ChecksPending: 'Admission',
  Admitted: 'Execution',
  Running: 'Execution',
  Evicted: 'Execution',
  Finished: 'Completion',
  Deactivated: 'Completion',
};

/**
 * Reasons that mean the Workload will not become admissible on its own.
 *
 * The distinction from {@link BLOCKED_REASONS} is the whole point of splitting
 * Inadmissible from Blocked: waiting for quota clears when other workloads
 * finish, a missing flavor does not.
 */
const INADMISSIBLE_REASONS = new Set([
  'NoMatchingFlavor',
  'ExceedsMaxQuota',
  'Misconfigured',
  'TopologyPlacementFailed',
]);

/** Reasons that clear on their own as the cluster drains. */
const BLOCKED_REASONS = new Set(['WaitingForQuota', 'WaitingForPreemptedWorkloads']);

function findCondition(conditions: WorkloadConditionLike[], type: string) {
  return conditions.find(c => c.type === type);
}

function isTrue(condition?: WorkloadConditionLike) {
  return condition?.status === 'True';
}

function state(
  stage: LifecycleStage,
  from?: WorkloadConditionLike | string,
  overrides: Partial<LifecycleState> = {}
): LifecycleState {
  const condition = typeof from === 'string' ? undefined : from;

  return {
    stage,
    phase: PHASE_OF[stage],
    reason: condition?.reason,
    message: condition?.message,
    derivedFrom: typeof from === 'string' ? from : from?.type,
    isTerminal: stage === 'Finished' || stage === 'Deactivated',
    ...overrides,
  };
}

/**
 * Works out which stage a Workload is in.
 *
 * Terminal states are checked first, because a Workload that finished after
 * being evicted twice is Finished, and timestamps are not reliable enough to
 * settle that by ordering alone.
 *
 * Two of these mappings are judgement calls rather than transcriptions, and
 * both are worth arguing about:
 *
 * - `TopologyPlacementFailed` is grouped with Inadmissible rather than Blocked,
 *   because it will not resolve as other workloads finish.
 * - `Suspended` maps to Deactivated rather than to a Pending sub-state, because
 *   a suspended Workload is not queued, it is switched off.
 *
 * @param conditions `status.conditions`, or an empty array for a brand new Workload.
 * @param admissionChecks `status.admissionChecks`, used to tell a pending check from a rejected one.
 */
export function deriveLifecycleState(
  conditions: WorkloadConditionLike[] = [],
  admissionChecks: AdmissionCheckStateLike[] = []
): LifecycleState {
  const deactivationTarget = findCondition(conditions, 'DeactivationTarget');
  if (deactivationTarget) {
    return state('Deactivated', deactivationTarget);
  }

  const finished = findCondition(conditions, 'Finished');
  if (isTrue(finished)) {
    return state('Finished', finished);
  }

  const requeued = findCondition(conditions, 'Requeued');
  const evicted = findCondition(conditions, 'Evicted');

  // Requeued is set after Evicted on the same Workload, so it wins.
  if (isTrue(requeued)) {
    return state('Requeued', requeued);
  }
  if (isTrue(evicted)) {
    return state('Evicted', evicted);
  }

  const admitted = findCondition(conditions, 'Admitted');
  if (isTrue(admitted)) {
    const podsReady = findCondition(conditions, 'PodsReady');
    return isTrue(podsReady) ? state('Running', podsReady) : state('Admitted', admitted);
  }

  const rejected = admissionChecks.find(check => check.state === 'Rejected');
  if (rejected) {
    return state('Evicted', `admissionCheck/${rejected.name}`, {
      reason: 'AdmissionCheckRejected',
      message: rejected.message,
    });
  }

  const quotaReserved = findCondition(conditions, 'QuotaReserved');
  if (isTrue(quotaReserved)) {
    const waiting = admissionChecks.find(
      check => check.state === 'Pending' || check.state === 'Retry'
    );

    if (waiting) {
      return state('ChecksPending', `admissionCheck/${waiting.name}`, {
        reason: waiting.state === 'Retry' ? 'AdmissionCheckRetry' : 'AdmissionCheckPending',
        message: waiting.message,
      });
    }

    return state('QuotaReserved', quotaReserved);
  }

  if (quotaReserved?.reason === 'Suspended') {
    return state('Deactivated', quotaReserved);
  }
  if (quotaReserved && INADMISSIBLE_REASONS.has(quotaReserved.reason ?? '')) {
    return state('Inadmissible', quotaReserved);
  }
  if (quotaReserved && BLOCKED_REASONS.has(quotaReserved.reason ?? '')) {
    return state('Blocked', quotaReserved);
  }

  return state('Pending', quotaReserved);
}

export interface TimelineEvent {
  /** RFC3339 timestamp. */
  at: string;
  label: string;
  source: 'condition' | 'admissionCheck' | 'requeue';
  severity: 'info' | 'warning' | 'error';
  detail?: string;
}

/** Conditions whose arrival is bad news, for timeline severity. */
const ERROR_CONDITIONS = new Set(['Evicted', 'Preempted', 'DeactivationTarget']);
const WARNING_CONDITIONS = new Set([
  'Requeued',
  'BlockedOnPreemptionGates',
  'WaitingForReplacementPods',
]);

function severityOf(type: string, status: ConditionStatus): TimelineEvent['severity'] {
  if (ERROR_CONDITIONS.has(type) && status === 'True') {
    return 'error';
  }
  if (WARNING_CONDITIONS.has(type) && status === 'True') {
    return 'warning';
  }
  return 'info';
}

/**
 * Merges condition transitions, admission check transitions and the pending
 * requeue time into one ordered list.
 *
 * Entries without a timestamp are dropped rather than sorted to the front:
 * `lastTransitionTime` is required on Workload conditions, so a missing one
 * means the object is malformed and guessing a position would be worse than
 * omitting it. Ties keep their input order, which for conditions is Kueue's
 * own ordering.
 */
export function buildTimeline(status: WorkloadStatusLike | undefined): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  (status?.conditions ?? []).forEach(condition => {
    if (!condition.lastTransitionTime) {
      return;
    }

    events.push({
      at: condition.lastTransitionTime,
      label: condition.reason ? `${condition.type}: ${condition.reason}` : condition.type,
      source: 'condition',
      severity: severityOf(condition.type, condition.status),
      detail: condition.message,
    });
  });

  (status?.admissionChecks ?? []).forEach(check => {
    if (!check.lastTransitionTime) {
      return;
    }

    events.push({
      at: check.lastTransitionTime,
      label: `${check.name}: ${check.state}`,
      source: 'admissionCheck',
      severity: check.state === 'Rejected' ? 'error' : check.state === 'Retry' ? 'warning' : 'info',
      detail: check.message,
    });
  });

  const requeueAt = status?.requeueState?.requeueAt;
  if (requeueAt) {
    events.push({
      at: requeueAt,
      label: 'Scheduled to requeue',
      source: 'requeue',
      severity: 'info',
      detail:
        status?.requeueState?.count !== undefined
          ? `Requeued ${status.requeueState.count} time(s) so far`
          : undefined,
    });
  }

  // Stable sort: Array.prototype.sort is stable in every engine Headlamp runs on,
  // so equal timestamps keep the order the API returned them in.
  return events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export interface CollapsedTimelineEvent extends TimelineEvent {
  /** How many consecutive identical events this entry stands for. */
  count: number;
  /** Timestamp of the last occurrence when count is above one. */
  lastAt: string;
}

/**
 * Collapses runs of identical adjacent events.
 *
 * A Workload that was preempted and requeued twenty times produces a timeline
 * that is technically complete and practically unreadable. Only adjacent
 * repeats collapse, so an eviction, then an admission, then another eviction
 * stays three entries.
 */
export function collapseRepeats(events: TimelineEvent[]): CollapsedTimelineEvent[] {
  const collapsed: CollapsedTimelineEvent[] = [];

  events.forEach(event => {
    const previous = collapsed[collapsed.length - 1];

    if (previous && previous.label === event.label && previous.source === event.source) {
      previous.count += 1;
      previous.lastAt = event.at;
      return;
    }

    collapsed.push({ ...event, count: 1, lastAt: event.at });
  });

  return collapsed;
}

/**
 * Totals eviction counts across reasons.
 *
 * Kueue already aggregates by reason and underlying cause, so this only sums.
 */
export function totalEvictions(evictions: EvictionStatLike[] = []): number {
  return evictions.reduce((total, eviction) => total + eviction.count, 0);
}

/**
 * Human-readable eviction label, keeping Kueue's own strings.
 *
 * `underlyingCause` is documented as possibly being an empty string rather than
 * absent, so both are treated the same.
 */
export function describeEviction(eviction: EvictionStatLike): string {
  return eviction.underlyingCause
    ? `${eviction.reason} (${eviction.underlyingCause})`
    : eviction.reason;
}
