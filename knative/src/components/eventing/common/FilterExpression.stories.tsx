/*
 * Copyright 2025 The Kubernetes Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Meta, StoryFn } from '@storybook/react';
import type React from 'react';
import { ReduxDecorator } from '../../../helpers/storybook';
import { FilterExpression } from './FilterExpression';

export default {
  title: 'knative/Eventing/FilterExpression',
  component: FilterExpression,
  decorators: [ReduxDecorator],
} as Meta;

const Template: StoryFn<React.ComponentProps<typeof FilterExpression>> = args => (
  <FilterExpression {...args} />
);

export const NoFilter = Template.bind({});
NoFilter.args = {
  view: { mode: 'all-events' },
};

export const LegacyAttributes = Template.bind({});
LegacyAttributes.args = {
  view: {
    mode: 'attributes',
    attributes: { type: 'dev.knative.samples.helloworld', source: '/shop/checkout' },
  },
};

export const SingleExactMatch = Template.bind({});
SingleExactMatch.args = {
  view: {
    mode: 'expressions',
    filters: [{ exact: { type: 'order.created' } }],
    legacyOverridden: false,
  },
};

export const MultipleExpressions = Template.bind({});
MultipleExpressions.args = {
  view: {
    mode: 'expressions',
    filters: [{ exact: { type: 'order.created' } }, { prefix: { source: '/shop' } }],
    legacyOverridden: false,
  },
};

export const NestedAnyInsideAll = Template.bind({});
NestedAnyInsideAll.args = {
  view: {
    mode: 'expressions',
    filters: [
      {
        all: [
          { prefix: { type: 'order.' } },
          { any: [{ exact: { region: 'eu-west' } }, { exact: { region: 'eu-central' } }] },
          { not: { suffix: { type: '.test' } } },
        ],
      },
    ],
    legacyOverridden: false,
  },
};

export const CesqlExpression = Template.bind({});
CesqlExpression.args = {
  view: {
    mode: 'expressions',
    filters: [{ cesql: "source LIKE '/shop/%' AND type = 'order.created'" }],
    legacyOverridden: false,
  },
};

/** The case this component exists for: a stale spec.filter the data plane ignores. */
export const LegacyFilterOverridden = Template.bind({});
LegacyFilterOverridden.args = {
  view: {
    mode: 'expressions',
    filters: [{ exact: { type: 'order.created' } }],
    legacyOverridden: true,
  },
};

export const EmptyExpressionNode = Template.bind({});
EmptyExpressionNode.args = {
  view: { mode: 'expressions', filters: [{}], legacyOverridden: false },
};
