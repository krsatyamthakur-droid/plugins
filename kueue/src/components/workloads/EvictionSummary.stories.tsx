import { Meta, StoryFn } from '@storybook/react';
import type React from 'react';
import { ReduxDecorator } from '../../helpers/storybook';
import EvictionSummary from './EvictionSummary';

export default {
  title: 'kueue/Workload/EvictionSummary',
  component: EvictionSummary,
  decorators: [ReduxDecorator],
} as Meta;

const Template: StoryFn<React.ComponentProps<typeof EvictionSummary>> = args => (
  <EvictionSummary {...args} />
);

/** Renders nothing rather than an empty box, which is the common case. */
export const NoEvictions = Template.bind({});
NoEvictions.args = { evictions: [] };

export const SingleReason = Template.bind({});
SingleReason.args = {
  evictions: [{ reason: 'Preempted', underlyingCause: '', count: 3 }],
};

export const MixedReasons = Template.bind({});
MixedReasons.args = {
  evictions: [
    { reason: 'Preempted', underlyingCause: '', count: 12 },
    { reason: 'PodsReadyTimeout', underlyingCause: '', count: 4 },
    { reason: 'Evicted', underlyingCause: 'NodeFailures', count: 2 },
    { reason: 'AdmissionCheck', underlyingCause: '', count: 1 },
  ],
};

/** Kueue documents underlyingCause as possibly an empty string, not absent. */
export const WithUnderlyingCauses = Template.bind({});
WithUnderlyingCauses.args = {
  evictions: [
    { reason: 'Evicted', underlyingCause: 'NodeFailures', count: 5 },
    { reason: 'Evicted', underlyingCause: 'ClusterQueueStopped', count: 2 },
  ],
};
