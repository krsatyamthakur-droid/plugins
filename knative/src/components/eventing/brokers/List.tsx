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
import type { KubeObject } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { Chip, Typography } from '@mui/material';
import { useMemo } from 'react';
import { useClusters } from '../../../hooks/useClusters';
import { Broker } from '../../../resources/knative/eventing';
import { getSafeUrl } from '../../../utils/url';
import { ReadyStatusLabel } from '../../common/ReadyStatusLabel';
import { SinkCell } from '../common/SinkCell';

type Column = ResourceTableColumn<KubeObject> | 'namespace' | 'cluster' | 'age' | 'name';

function useBrokerColumns(clusters: string[]): Column[] {
  const showClusterColumn = clusters.length > 1;

  return useMemo<Column[]>(
    () => [
      'name',
      'namespace',
      ...(showClusterColumn ? (['cluster'] as const) : []),
      {
        id: 'class',
        label: 'Class',
        gridTemplate: 'auto',
        getValue: item => (item as Broker).brokerClass ?? '',
        render: item => {
          const brokerClass = (item as Broker).brokerClass;
          return brokerClass ? (
            <Chip label={brokerClass} size="small" variant="outlined" />
          ) : (
            <Typography variant="body2" color="text.secondary">
              -
            </Typography>
          );
        },
      },
      {
        id: 'url',
        label: 'URL',
        gridTemplate: 'auto',
        getValue: item => (item as Broker).address ?? '',
        render: item => {
          const url = getSafeUrl((item as Broker).address);
          return url ? (
            <Typography variant="body2" noWrap sx={{ maxWidth: 340 }}>
              {url}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Pending
            </Typography>
          );
        },
      },
      {
        id: 'deadlettersink',
        label: 'Dead Letter Sink',
        gridTemplate: 'auto',
        disableFiltering: true,
        getValue: item => (item as Broker).deadLetterSinkUri ?? '',
        render: item => {
          const broker = item as Broker;
          return (
            <SinkCell
              destination={broker.deadLetterSink}
              ownerNamespace={broker.metadata.namespace || ''}
            />
          );
        },
      },
      {
        id: 'ready',
        label: 'Ready',
        gridTemplate: 'min-content',
        disableFiltering: true,
        getValue: item => ((item as Broker).isReady ? 1 : 0),
        render: item => {
          const condition = (item as Broker).readyCondition;
          return (
            <ReadyStatusLabel
              status={condition?.status ?? 'Unknown'}
              reason={condition?.reason}
              message={condition?.message}
            />
          );
        },
        sort: (a, b) => Number((a as Broker).isReady) - Number((b as Broker).isReady),
      },
      'age',
    ],
    [showClusterColumn]
  );
}

function BrokersListContents({ clusters }: { clusters: string[] }) {
  const columns = useBrokerColumns(clusters);

  return (
    <ResourceListView
      title="Brokers"
      resourceClass={Broker}
      columns={columns}
      reflectInURL="knative-brokers"
      id="knative-brokers"
    />
  );
}

export function BrokersList() {
  const clusters = useClusters();

  return <BrokersListContents clusters={clusters} />;
}
