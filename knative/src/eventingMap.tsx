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

import { Icon } from '@iconify/react';
import { DetailsGrid } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import type {
  GraphEdge,
  GraphNode,
  GraphNodeStatus,
} from '@kinvolk/headlamp-plugin/lib/components/resourceMap/graph/graphModel';
import { useMemo } from 'react';
import { Broker, Trigger } from './resources/knative/eventing';
import { describeSink } from './utils/sink';
import { summarizeFilter } from './utils/triggerFilter';

/** Map source ids, referenced by the relation comment at the bottom of this file. */
const BROKER_SOURCE_ID = 'knative-broker';
const TRIGGER_SOURCE_ID = 'knative-trigger';

const KNATIVE_ICON_COLOR = 'rgb(7, 102, 174)';

const eventingIcon = (
  <Icon icon="custom:knative" width="100%" height="100%" color={KNATIVE_ICON_COLOR} />
);

const BrokerDetails = ({ node }: { node: GraphNode }) => (
  <DetailsGrid
    resourceType={Broker}
    name={node.kubeObject?.metadata.name ?? ''}
    namespace={node.kubeObject?.metadata.namespace}
    withEvents
    extraInfo={item => {
      const broker = item as Broker | null;
      if (!broker) {
        return null;
      }

      return [
        { name: 'Ready', value: broker.isReady ? 'True' : 'False' },
        { name: 'Class', value: broker.brokerClass || '-' },
        { name: 'URL', value: broker.address || 'Pending' },
        { name: 'Dead Letter Sink', value: broker.deadLetterSinkUri || '-' },
      ];
    }}
  />
);

const TriggerDetails = ({ node }: { node: GraphNode }) => (
  <DetailsGrid
    resourceType={Trigger}
    name={node.kubeObject?.metadata.name ?? ''}
    namespace={node.kubeObject?.metadata.namespace}
    withEvents
    extraInfo={item => {
      const trigger = item as Trigger | null;
      if (!trigger) {
        return null;
      }

      return [
        { name: 'Ready', value: trigger.isReady ? 'True' : 'False' },
        { name: 'Broker', value: trigger.brokerName || '-' },
        { name: 'Filter', value: summarizeFilter(trigger.filterView) },
        {
          name: 'Subscriber',
          value: describeSink(trigger.subscriber, trigger.metadata.namespace || '') || 'Unresolved',
        },
      ];
    }}
  />
);

function readyStatus(isReady: boolean): GraphNodeStatus {
  return isReady ? 'success' : 'error';
}

const brokerSource = {
  id: BROKER_SOURCE_ID,
  label: 'Brokers',
  icon: eventingIcon,
  useData() {
    const [brokers] = Broker.useList();

    return useMemo(() => {
      if (!brokers) {
        return null;
      }

      return {
        nodes: brokers.map(broker => ({
          id: broker.metadata.uid,
          kubeObject: broker,
          detailsComponent: BrokerDetails,
          weight: 1100,
          status: readyStatus(broker.isReady),
        })),
        edges: [],
      };
    }, [brokers]);
  },
};

/** Key for looking a Broker up by the namespace/name a Trigger references. */
function brokerKey(namespace: string | undefined, name: string | undefined): string {
  return `${namespace ?? ''}/${name ?? ''}`;
}

const triggerSource = {
  id: TRIGGER_SOURCE_ID,
  label: 'Triggers',
  icon: eventingIcon,
  useData() {
    const [triggers] = Trigger.useList();
    const [brokers] = Broker.useList();

    return useMemo(() => {
      if (!triggers) {
        return null;
      }

      // Index the Brokers once rather than scanning them per Trigger. The
      // Serving side of the map does the same thing for Revision to KService.
      const brokersByKey = new Map<string, Broker>();
      brokers?.forEach(broker => {
        brokersByKey.set(brokerKey(broker.metadata.namespace, broker.metadata.name), broker);
      });

      const edges: GraphEdge[] = [];

      const nodes = triggers.map(trigger => {
        const broker = brokersByKey.get(brokerKey(trigger.brokerNamespace, trigger.brokerName));

        if (broker) {
          edges.push({
            id: `${broker.metadata.uid}-${trigger.metadata.uid}`,
            source: broker.metadata.uid,
            target: trigger.metadata.uid,
            label: trigger.isCrossNamespace ? 'cross-namespace' : undefined,
          });
        }

        return {
          id: trigger.metadata.uid,
          kubeObject: trigger,
          detailsComponent: TriggerDetails,
          weight: 1050,
          // A Trigger whose subscriber never resolved is Ready=False but is
          // worth distinguishing from a Trigger that is simply still starting.
          status: trigger.hasUnresolvedSubscriber
            ? ('warning' as GraphNodeStatus)
            : readyStatus(trigger.isReady),
        };
      });

      return { nodes, edges };
    }, [triggers, brokers]);
  },
};

/**
 * The Eventing group for the Knative map, alongside the existing Serving one.
 */
export const knativeEventingSource = {
  id: 'knative-eventing',
  label: 'Knative Eventing',
  icon: eventingIcon,
  sources: [brokerSource, triggerSource],
};

/*
 * On the Broker to Trigger edge.
 *
 * Headlamp core has `registerResourceRelationProvider`, which is the natural
 * home for an edge whose endpoints live in two different map sources. It is
 * not usable here yet: it exists on headlamp main
 * (frontend/src/plugin/registry.tsx) but is not exported by
 * @kinvolk/headlamp-plugin 0.14.0, the version this plugin pins. Importing it
 * fails type checking against the published types.
 *
 * So the edge is built inside the Trigger source, which is what the Serving
 * sources already do for Revision to KService. The cost is that the Trigger
 * source also has to list Brokers. Once the plugin API is bumped past the
 * release that exports the relation provider, this moves out to:
 *
 *   registerResourceRelationProvider({
 *     id: 'knative.trigger-to-broker',
 *     fromSource: TRIGGER_SOURCE_ID,
 *     toSource: BROKER_SOURCE_ID,
 *     label: 'subscribes to',
 *     predicate: (from, to) => ...,
 *   })
 */
