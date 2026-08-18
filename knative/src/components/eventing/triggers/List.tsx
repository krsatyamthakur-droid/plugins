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

import {
  ResourceListView,
  type ResourceTableColumn,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { Link } from '@kinvolk/headlamp-plugin/lib/components/common';
import type { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { Chip, Tooltip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useClusters } from '../../../hooks/useClusters';
import { Trigger } from '../../../resources/knative/eventing';
import { summarizeFilter } from '../../../utils/triggerFilter';
import { ReadyStatusLabel } from '../../common/ReadyStatusLabel';
import { SinkCell } from '../common/SinkCell';

type Column = ResourceTableColumn<KubeObject> | 'namespace' | 'cluster' | 'age' | 'name';

function useTriggerColumns(clusters: string[]): Column[] {
  const showClusterColumn = clusters.length > 1;

  return useMemo<Column[]>(
    () => [
      {
        id: 'name',
        label: 'Name',
        gridTemplate: 'auto',
        getValue: item => item.metadata?.name ?? '',
        render: item => (
          <Link
            routeName="knativeTriggerDetails"
            params={{ namespace: item.metadata.namespace, name: item.metadata.name }}
            activeCluster={item.cluster}
          >
            {item.metadata.name}
          </Link>
        ),
      },
      'namespace',
      ...(showClusterColumn ? (['cluster'] as const) : []),
      {
        id: 'broker',
        label: 'Broker',
        gridTemplate: 'auto',
        getValue: item => (item as Trigger).brokerName ?? '',
        render: item => {
          const trigger = item as Trigger;
          const name = trigger.brokerName;

          if (!name) {
            return (
              <Typography variant="body2" color="warning.main">
                Not set
              </Typography>
            );
          }

          // A cross-namespace brokerRef only works when the cluster has the
          // cross-namespace-event-links feature on, so it is worth calling out.
          return trigger.isCrossNamespace ? (
            <Tooltip title={`Cross-namespace reference to ${trigger.brokerNamespace}`}>
              <Typography variant="body2" noWrap>
                {trigger.brokerNamespace}/{name}
              </Typography>
            </Tooltip>
          ) : (
            <Typography variant="body2" noWrap>
              {name}
            </Typography>
          );
        },
      },
      {
        id: 'filter',
        label: 'Filter',
        gridTemplate: 'auto',
        getValue: item => summarizeFilter((item as Trigger).filterView),
        render: item => {
          const view = (item as Trigger).filterView;
          const summary = summarizeFilter(view);
          const stale = view.mode === 'expressions' && view.legacyOverridden;

          return (
            <Tooltip
              title={
                stale ? 'spec.filter is also set on this Trigger and is being ignored' : summary
              }
            >
              <Typography
                variant="body2"
                noWrap
                sx={{ maxWidth: 260 }}
                color={stale ? 'warning.main' : undefined}
              >
                {summary}
              </Typography>
            </Tooltip>
          );
        },
      },
      {
        id: 'subscriber',
        label: 'Subscriber',
        gridTemplate: 'auto',
        disableFiltering: true,
        getValue: item => (item as Trigger).subscriberUri ?? '',
        render: item => {
          const trigger = item as Trigger;
          return (
            <SinkCell
              destination={trigger.subscriber}
              ownerNamespace={trigger.metadata.namespace || ''}
            />
          );
        },
      },
      {
        id: 'ready',
        label: 'Ready',
        gridTemplate: 'min-content',
        disableFiltering: true,
        getValue: item => ((item as Trigger).isReady ? 1 : 0),
        render: item => {
          const trigger = item as Trigger;
          const condition = trigger.readyCondition;

          return (
            <>
              <ReadyStatusLabel
                status={condition?.status ?? 'Unknown'}
                reason={condition?.reason}
                message={condition?.message}
              />
              {trigger.hasUnresolvedSubscriber && (
                <Chip
                  label="Subscriber unresolved"
                  size="small"
                  color="warning"
                  variant="outlined"
                  sx={{ ml: 0.5 }}
                />
              )}
            </>
          );
        },
        sort: (a, b) => Number((a as Trigger).isReady) - Number((b as Trigger).isReady),
      },
      'age',
    ],
    [showClusterColumn]
  );
}

function TriggersListContents({ clusters }: { clusters: string[] }) {
  const columns = useTriggerColumns(clusters);

  return (
    <ResourceListView
      title="Triggers"
      resourceClass={Trigger}
      columns={columns}
      reflectInURL="knative-triggers"
      id="knative-triggers"
    />
  );
}

export function TriggersList() {
  const clusters = useClusters();

  return <TriggersListContents clusters={clusters} />;
}
