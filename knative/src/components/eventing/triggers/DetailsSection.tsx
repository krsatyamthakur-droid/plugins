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

import type { DetailsViewSectionProps } from '@kinvolk/headlamp-plugin/lib';
import { NameValueTable, SectionBox } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Typography } from '@mui/material';
import { EVENTING_API_VERSION, Trigger } from '../../../resources/knative/eventing';
import { describeSink } from '../../../utils/sink';
import { buildFilterView } from '../../../utils/triggerFilter';
import { FilterExpression } from '../common/FilterExpression';

/**
 * Event routing section injected into Headlamp's generic Custom Resource detail
 * page for Triggers.
 *
 * The three things this answers are the three a raw YAML view makes you work
 * out by hand: which Broker, which events, and which subscriber.
 */
export function TriggerDetailsSection({ resource }: DetailsViewSectionProps) {
  if (
    resource?.jsonData?.kind !== Trigger.kind ||
    resource?.jsonData?.apiVersion !== EVENTING_API_VERSION
  ) {
    return null;
  }

  const spec = resource.jsonData.spec ?? {};
  const status = resource.jsonData.status ?? {};
  const ownNamespace = resource.jsonData.metadata?.namespace ?? '';

  const brokerName = spec.brokerRef?.name || spec.broker;
  const brokerNamespace = spec.brokerRef?.namespace || ownNamespace;
  const isCrossNamespace = !!spec.brokerRef?.namespace && spec.brokerRef.namespace !== ownNamespace;

  const rows = [
    {
      name: 'Broker',
      value: brokerName
        ? isCrossNamespace
          ? `${brokerNamespace}/${brokerName} (cross-namespace)`
          : brokerName
        : 'Not set',
    },
    {
      name: 'Filter',
      value: <FilterExpression view={buildFilterView(spec)} />,
    },
    {
      name: 'Subscriber',
      value: describeSink(spec.subscriber, ownNamespace) ?? 'Unresolved',
    },
    {
      name: 'Resolved subscriber URI',
      value: status.subscriberUri || 'Pending',
    },
    {
      name: 'Dead letter sink',
      value: describeSink(spec.delivery?.deadLetterSink, ownNamespace) ?? '-',
    },
  ];

  return (
    <SectionBox title="Event Routing">
      <NameValueTable rows={rows} />
      {!brokerName && (
        <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
          This Trigger references no Broker, so it will never receive events.
        </Typography>
      )}
    </SectionBox>
  );
}
