import { describe, expect, it } from 'vitest';
import {
  type AdmissionCheckStateLike,
  buildTimeline,
  collapseRepeats,
  deriveLifecycleState,
  describeEviction,
  totalEvictions,
  type WorkloadConditionLike,
} from './workloadLifecycle';

function condition(
  type: string,
  status: 'True' | 'False' | 'Unknown',
  reason?: string,
  lastTransitionTime?: string
): WorkloadConditionLike {
  return { type, status, reason, lastTransitionTime };
}

function check(name: string, state: string, lastTransitionTime?: string): AdmissionCheckStateLike {
  return { name, state, lastTransitionTime };
}

describe('deriveLifecycleState', () => {
  it('reports Pending for a Workload with no conditions yet', () => {
    // The first second of a Workload's life, and the input a naive find() trips on.
    const result = deriveLifecycleState([]);

    expect(result).toMatchObject({ stage: 'Pending', phase: 'Queueing', isTerminal: false });
    expect(deriveLifecycleState()).toMatchObject({ stage: 'Pending' });
  });

  it('reports Pending while Kueue is still evaluating', () => {
    const result = deriveLifecycleState([condition('QuotaReserved', 'False', 'PendingEvaluation')]);

    expect(result).toMatchObject({ stage: 'Pending', reason: 'PendingEvaluation' });
  });

  it('separates Blocked from Inadmissible, which a conditions table cannot', () => {
    // WaitingForQuota clears when other workloads finish. NoMatchingFlavor never does.
    const blocked = deriveLifecycleState([condition('QuotaReserved', 'False', 'WaitingForQuota')]);
    const inadmissible = deriveLifecycleState([
      condition('QuotaReserved', 'False', 'NoMatchingFlavor'),
    ]);

    expect(blocked.stage).toBe('Blocked');
    expect(inadmissible.stage).toBe('Inadmissible');
  });

  it('treats every non-recoverable quota reason as Inadmissible', () => {
    for (const reason of ['NoMatchingFlavor', 'ExceedsMaxQuota', 'Misconfigured']) {
      expect(deriveLifecycleState([condition('QuotaReserved', 'False', reason)]).stage).toBe(
        'Inadmissible'
      );
    }
  });

  it('groups TopologyPlacementFailed with Inadmissible, not Blocked', () => {
    // Judgement call: a topology that cannot be satisfied will not become
    // satisfiable as the cluster drains.
    expect(
      deriveLifecycleState([condition('QuotaReserved', 'False', 'TopologyPlacementFailed')]).stage
    ).toBe('Inadmissible');
  });

  it('treats WaitingForPreemptedWorkloads as Blocked', () => {
    expect(
      deriveLifecycleState([condition('QuotaReserved', 'False', 'WaitingForPreemptedWorkloads')])
        .stage
    ).toBe('Blocked');
  });

  it('maps a Suspended workload to Deactivated rather than Pending', () => {
    // Judgement call: suspended is not queued, it is switched off.
    const result = deriveLifecycleState([condition('QuotaReserved', 'False', 'Suspended')]);

    expect(result).toMatchObject({ stage: 'Deactivated', isTerminal: true });
  });

  it('reports QuotaReserved when quota is held and there are no checks', () => {
    const result = deriveLifecycleState([condition('QuotaReserved', 'True')]);

    expect(result).toMatchObject({
      stage: 'QuotaReserved',
      phase: 'Admission',
      derivedFrom: 'QuotaReserved',
    });
  });

  it('reports ChecksPending while an admission check is Pending', () => {
    const result = deriveLifecycleState(
      [condition('QuotaReserved', 'True')],
      [check('sample-multikueue', 'Pending')]
    );

    expect(result).toMatchObject({
      stage: 'ChecksPending',
      reason: 'AdmissionCheckPending',
      derivedFrom: 'admissionCheck/sample-multikueue',
    });
  });

  it('treats Retry as pending rather than as failure', () => {
    // Retry means the check controller will try again, often after
    // requeueAfterSeconds. It is not a rejection.
    const result = deriveLifecycleState(
      [condition('QuotaReserved', 'True')],
      [check('provisioning', 'Retry')]
    );

    expect(result).toMatchObject({ stage: 'ChecksPending', reason: 'AdmissionCheckRetry' });
  });

  it('treats a Rejected check as terminal for this admission attempt', () => {
    const result = deriveLifecycleState(
      [condition('QuotaReserved', 'True')],
      [check('provisioning', 'Rejected')]
    );

    expect(result).toMatchObject({ stage: 'Evicted', reason: 'AdmissionCheckRejected' });
  });

  it('ignores Ready checks when deciding whether admission is still pending', () => {
    const result = deriveLifecycleState(
      [condition('QuotaReserved', 'True')],
      [check('a', 'Ready'), check('b', 'Ready')]
    );

    expect(result.stage).toBe('QuotaReserved');
  });

  it('separates Admitted from Running', () => {
    // Admitted means quota and checks are done. It does not mean pods exist.
    const admitted = deriveLifecycleState([condition('Admitted', 'True')]);
    const running = deriveLifecycleState([
      condition('Admitted', 'True'),
      condition('PodsReady', 'True'),
    ]);

    expect(admitted).toMatchObject({ stage: 'Admitted', phase: 'Execution' });
    expect(running).toMatchObject({ stage: 'Running', derivedFrom: 'PodsReady' });
  });

  it('does not call a Workload Running when PodsReady is False', () => {
    const result = deriveLifecycleState([
      condition('Admitted', 'True'),
      condition('PodsReady', 'False'),
    ]);

    expect(result.stage).toBe('Admitted');
  });

  it('lets Requeued win over Evicted, since it is set afterwards', () => {
    const result = deriveLifecycleState([
      condition('Evicted', 'True', 'Preempted'),
      condition('Requeued', 'True', 'BackoffFinished'),
    ]);

    expect(result).toMatchObject({ stage: 'Requeued', phase: 'Queueing' });
  });

  it('lets Finished win over Evicted regardless of order', () => {
    const result = deriveLifecycleState([
      condition('Finished', 'True'),
      condition('Evicted', 'True', 'Preempted'),
    ]);

    expect(result).toMatchObject({ stage: 'Finished', isTerminal: true });
  });

  it('lets DeactivationTarget override everything', () => {
    const result = deriveLifecycleState([
      condition('Admitted', 'True'),
      condition('PodsReady', 'True'),
      condition('DeactivationTarget', 'True', 'Deactivated'),
    ]);

    expect(result).toMatchObject({ stage: 'Deactivated', isTerminal: true });
  });

  it('passes Kueue reason and message through unchanged', () => {
    // The UI must not paraphrase these, or it stops matching kubectl output.
    const result = deriveLifecycleState([
      {
        type: 'QuotaReserved',
        status: 'False',
        reason: 'NoMatchingFlavor',
        message: "couldn't assign flavors to pod set main: insufficient quota for nvidia.com/gpu",
      },
    ]);

    expect(result.reason).toBe('NoMatchingFlavor');
    expect(result.message).toContain('nvidia.com/gpu');
  });
});

describe('buildTimeline', () => {
  it('returns nothing for an empty or missing status', () => {
    expect(buildTimeline(undefined)).toEqual([]);
    expect(buildTimeline({})).toEqual([]);
  });

  it('orders events by timestamp across all three sources', () => {
    const events = buildTimeline({
      conditions: [
        condition('Admitted', 'True', undefined, '2026-08-05T10:02:00Z'),
        condition('QuotaReserved', 'True', undefined, '2026-08-05T10:00:00Z'),
      ],
      admissionChecks: [check('multikueue', 'Ready', '2026-08-05T10:01:00Z')],
      requeueState: { count: 1, requeueAt: '2026-08-05T10:03:00Z' },
    });

    expect(events.map(e => e.source)).toEqual([
      'condition',
      'admissionCheck',
      'condition',
      'requeue',
    ]);
  });

  it('keeps input order for identical timestamps', () => {
    const at = '2026-08-05T10:00:00Z';
    const events = buildTimeline({
      conditions: [
        condition('QuotaReserved', 'True', undefined, at),
        condition('Admitted', 'True', undefined, at),
      ],
    });

    expect(events.map(e => e.label)).toEqual(['QuotaReserved', 'Admitted']);
  });

  it('drops entries with no timestamp rather than guessing a position', () => {
    const events = buildTimeline({
      conditions: [
        condition('QuotaReserved', 'True'),
        condition('Admitted', 'True', undefined, '2026-08-05T10:00:00Z'),
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0].label).toBe('Admitted');
  });

  it('includes the reason in the label when Kueue gave one', () => {
    const events = buildTimeline({
      conditions: [condition('Evicted', 'True', 'Preempted', '2026-08-05T10:00:00Z')],
    });

    expect(events[0].label).toBe('Evicted: Preempted');
  });

  it('marks evictions and preemptions as errors, requeues as warnings', () => {
    const events = buildTimeline({
      conditions: [
        condition('Evicted', 'True', 'Preempted', '2026-08-05T10:00:00Z'),
        condition('Requeued', 'True', 'BackoffFinished', '2026-08-05T10:01:00Z'),
        condition('Admitted', 'True', undefined, '2026-08-05T10:02:00Z'),
      ],
    });

    expect(events.map(e => e.severity)).toEqual(['error', 'warning', 'info']);
  });

  it('does not mark a False Evicted condition as an error', () => {
    const events = buildTimeline({
      conditions: [condition('Evicted', 'False', undefined, '2026-08-05T10:00:00Z')],
    });

    expect(events[0].severity).toBe('info');
  });

  it('marks a rejected admission check as an error and a retry as a warning', () => {
    const events = buildTimeline({
      admissionChecks: [
        check('a', 'Rejected', '2026-08-05T10:00:00Z'),
        check('b', 'Retry', '2026-08-05T10:01:00Z'),
        check('c', 'Ready', '2026-08-05T10:02:00Z'),
      ],
    });

    expect(events.map(e => e.severity)).toEqual(['error', 'warning', 'info']);
  });
});

describe('collapseRepeats', () => {
  it('collapses a long run of identical evictions', () => {
    const events = Array.from({ length: 20 }, (_, index) => ({
      at: `2026-08-05T10:${String(index).padStart(2, '0')}:00Z`,
      label: 'Evicted: Preempted',
      source: 'condition' as const,
      severity: 'error' as const,
    }));

    const collapsed = collapseRepeats(events);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].count).toBe(20);
    expect(collapsed[0].at).toBe('2026-08-05T10:00:00Z');
    expect(collapsed[0].lastAt).toBe('2026-08-05T10:19:00Z');
  });

  it('only collapses adjacent repeats', () => {
    const evicted = {
      label: 'Evicted: Preempted',
      source: 'condition' as const,
      severity: 'error' as const,
    };
    const collapsed = collapseRepeats([
      { ...evicted, at: '2026-08-05T10:00:00Z' },
      { at: '2026-08-05T10:01:00Z', label: 'Admitted', source: 'condition', severity: 'info' },
      { ...evicted, at: '2026-08-05T10:02:00Z' },
    ]);

    expect(collapsed.map(e => e.count)).toEqual([1, 1, 1]);
  });

  it('handles an empty timeline', () => {
    expect(collapseRepeats([])).toEqual([]);
  });
});

describe('eviction helpers', () => {
  it('sums counts across reasons', () => {
    expect(
      totalEvictions([
        { reason: 'Preempted', underlyingCause: '', count: 3 },
        { reason: 'PodsReadyTimeout', underlyingCause: '', count: 2 },
      ])
    ).toBe(5);
    expect(totalEvictions()).toBe(0);
  });

  it('appends the underlying cause only when there is one', () => {
    // Kueue documents underlyingCause as possibly an empty string, not absent.
    expect(describeEviction({ reason: 'Preempted', underlyingCause: '', count: 1 })).toBe(
      'Preempted'
    );
    expect(describeEviction({ reason: 'Evicted', underlyingCause: 'NodeFailures', count: 1 })).toBe(
      'Evicted (NodeFailures)'
    );
  });
});
