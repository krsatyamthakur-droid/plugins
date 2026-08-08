import { Meta, StoryFn } from '@storybook/react';
import type React from 'react';
import { ReduxDecorator } from '../../helpers/storybook';
import type { WorkloadStatusLike } from '../../resources/workloadLifecycle';
import LifecycleSection from './LifecycleSection';

/**
 * These stories are the reason the component is testable at all.
 *
 * Half of these states are ones you cannot conjure on a cluster on demand: a
 * Workload caught mid-nomination, or one that has been preempted twenty times.
 * The status objects below are shaped exactly as Kueue writes them.
 */
export default {
  title: 'kueue/Workload/LifecycleSection',
  component: LifecycleSection,
  decorators: [ReduxDecorator],
} as Meta;

const Template: StoryFn<React.ComponentProps<typeof LifecycleSection>> = args => (
  <LifecycleSection {...args} />
);

export const BrandNew = Template.bind({});
BrandNew.args = { status: {} };

export const PendingEvaluation = Template.bind({});
PendingEvaluation.args = {
  status: {
    conditions: [
      {
        type: 'QuotaReserved',
        status: 'False',
        reason: 'PendingEvaluation',
        message: 'The workload is pending evaluation in the scheduling queue',
        lastTransitionTime: '2026-08-05T09:00:00Z',
      },
    ],
  } as WorkloadStatusLike,
};

/** Clears on its own once other workloads finish. Must not read as an error. */
export const BlockedOnQuota = Template.bind({});
BlockedOnQuota.args = {
  status: {
    conditions: [
      {
        type: 'QuotaReserved',
        status: 'False',
        reason: 'WaitingForQuota',
        message: 'insufficient unused quota for nvidia.com/gpu in flavor gpu-a100, 4 more needed',
        lastTransitionTime: '2026-08-05T09:00:00Z',
      },
    ],
  } as WorkloadStatusLike,
};

/** Never clears on its own. Looks identical to the above in a conditions table. */
export const Inadmissible = Template.bind({});
Inadmissible.args = {
  status: {
    conditions: [
      {
        type: 'QuotaReserved',
        status: 'False',
        reason: 'NoMatchingFlavor',
        message: "couldn't assign flavors to pod set main: insufficient quota for nvidia.com/gpu",
        lastTransitionTime: '2026-08-05T09:00:00Z',
      },
    ],
  } as WorkloadStatusLike,
};

export const WaitingOnAdmissionCheck = Template.bind({});
WaitingOnAdmissionCheck.args = {
  status: {
    conditions: [
      { type: 'QuotaReserved', status: 'True', lastTransitionTime: '2026-08-05T09:01:00Z' },
    ],
    admissionChecks: [
      {
        name: 'sample-multikueue',
        state: 'Pending',
        message: 'The workload got reservation on worker1',
        lastTransitionTime: '2026-08-05T09:01:30Z',
      },
    ],
  } as WorkloadStatusLike,
};

/** Retry is not failure. requeueAfterSeconds explains the wait. */
export const AdmissionCheckRetrying = Template.bind({});
AdmissionCheckRetrying.args = {
  status: {
    conditions: [
      { type: 'QuotaReserved', status: 'True', lastTransitionTime: '2026-08-05T09:01:00Z' },
    ],
    admissionChecks: [
      {
        name: 'provisioning',
        state: 'Retry',
        requeueAfterSeconds: 60,
        message: 'ProvisioningRequest is not provisioned, retrying',
        lastTransitionTime: '2026-08-05T09:02:00Z',
      },
    ],
  } as WorkloadStatusLike,
};

export const Running = Template.bind({});
Running.args = {
  status: {
    conditions: [
      { type: 'QuotaReserved', status: 'True', lastTransitionTime: '2026-08-05T09:01:00Z' },
      { type: 'Admitted', status: 'True', lastTransitionTime: '2026-08-05T09:01:05Z' },
      { type: 'PodsReady', status: 'True', lastTransitionTime: '2026-08-05T09:02:10Z' },
    ],
    admissionChecks: [
      { name: 'sample-multikueue', state: 'Ready', lastTransitionTime: '2026-08-05T09:01:04Z' },
    ],
  } as WorkloadStatusLike,
};

export const Finished = Template.bind({});
Finished.args = {
  status: {
    conditions: [
      { type: 'QuotaReserved', status: 'True', lastTransitionTime: '2026-08-05T09:01:00Z' },
      { type: 'Admitted', status: 'True', lastTransitionTime: '2026-08-05T09:01:05Z' },
      { type: 'PodsReady', status: 'True', lastTransitionTime: '2026-08-05T09:02:10Z' },
      {
        type: 'Finished',
        status: 'True',
        reason: 'Succeeded',
        message: 'Job finished successfully',
        lastTransitionTime: '2026-08-05T09:31:00Z',
      },
    ],
  } as WorkloadStatusLike,
};

export const PreemptedAndRequeued = Template.bind({});
PreemptedAndRequeued.args = {
  status: {
    conditions: [
      { type: 'QuotaReserved', status: 'True', lastTransitionTime: '2026-08-05T09:01:00Z' },
      { type: 'Admitted', status: 'True', lastTransitionTime: '2026-08-05T09:01:05Z' },
      {
        type: 'Evicted',
        status: 'True',
        reason: 'Preempted',
        message: 'Preempted to accommodate a workload (UID: 8f2a) due to prioritization',
        lastTransitionTime: '2026-08-05T09:14:00Z',
      },
      {
        type: 'Requeued',
        status: 'True',
        reason: 'BackoffFinished',
        lastTransitionTime: '2026-08-05T09:14:30Z',
      },
    ],
    requeueState: { count: 3, requeueAt: '2026-08-05T09:16:00Z' },
  } as WorkloadStatusLike,
};

/** The readability case. Twenty raw entries, collapsed to one. */
export const RepeatedlyPreempted = Template.bind({});
RepeatedlyPreempted.args = {
  status: {
    conditions: Array.from({ length: 20 }, (_, index) => ({
      type: 'Evicted',
      status: 'True' as const,
      reason: 'Preempted',
      lastTransitionTime: `2026-08-05T09:${String(index).padStart(2, '0')}:00Z`,
    })),
  } as WorkloadStatusLike,
};

export const AdmissionCheckRejected = Template.bind({});
AdmissionCheckRejected.args = {
  status: {
    conditions: [
      { type: 'QuotaReserved', status: 'True', lastTransitionTime: '2026-08-05T09:01:00Z' },
    ],
    admissionChecks: [
      {
        name: 'provisioning',
        state: 'Rejected',
        message: 'ProvisioningRequest failed: capacity not available in zone us-central1-a',
        lastTransitionTime: '2026-08-05T09:06:00Z',
      },
    ],
  } as WorkloadStatusLike,
};

export const Deactivated = Template.bind({});
Deactivated.args = {
  status: {
    conditions: [
      { type: 'QuotaReserved', status: 'True', lastTransitionTime: '2026-08-05T09:01:00Z' },
      { type: 'Admitted', status: 'True', lastTransitionTime: '2026-08-05T09:01:05Z' },
      {
        type: 'DeactivationTarget',
        status: 'True',
        reason: 'Deactivated',
        message: 'The workload was deactivated after exceeding the maximum number of re-queues',
        lastTransitionTime: '2026-08-05T09:40:00Z',
      },
    ],
  } as WorkloadStatusLike,
};
