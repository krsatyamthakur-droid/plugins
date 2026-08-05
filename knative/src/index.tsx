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
import {
  type DetailsViewSectionProps,
  registerDetailsViewSection,
  registerKindIcon,
  registerKubeObjectGlance,
  registerMapSource,
  registerRoute,
  registerSidebarEntry,
  registerSidebarEntryFilter,
  Utils,
} from '@kinvolk/headlamp-plugin/lib';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { ClusterDomainClaimsList } from './components/clusterdomainclaims/List';
import { DomainMappingsList } from './components/domainmappings/List';
import { BrokersList } from './components/eventing/brokers/List';
import { TriggerDetailsSection } from './components/eventing/triggers/DetailsSection';
import { TriggersList } from './components/eventing/triggers/List';
import { KServiceDetail } from './components/kservices/Detail';
import { KServicesList } from './components/kservices/List';
import { NetworkingOverview } from './components/networking/Overview';
import { RevisionDetail } from './components/revisions/Detail';
import { RevisionsList } from './components/revisions/List';
import { knativeEventingSource } from './eventingMap';
import { isKnativeEventingInstalled, isKnativeServingInstalled } from './isKnativeInstalled';
import { registerKnativeIcon } from './knativeIcon';
import { knativePluginSource } from './mapView';

registerKnativeIcon();

const queryClient = new QueryClient();

function withQueryClient(Component: React.ComponentType) {
  return React.memo(function WithQueryClient() {
    return (
      <QueryClientProvider client={queryClient}>
        <Component />
      </QueryClientProvider>
    );
  });
}

/** Sidebar entries that only make sense when Knative Eventing is installed. */
const EVENTING_SIDEBAR_ENTRIES = new Set(['brokers', 'triggers']);

// Track whether Knative CRDs exist per cluster to hide sidebar.
const servingInstalledByCluster: Record<string, boolean> = {};
const eventingInstalledByCluster: Record<string, boolean> = {};
const lastCheckedAt: Record<string, number> = {};
const inFlight: Record<string, boolean> = {};
const CHECK_TTL_MS = 30 * 1000;

/**
 * Checks which Knative components are installed on the given cluster.
 *
 * Serving and Eventing are probed separately because they install from separate
 * release YAMLs. A cluster can have either one on its own.
 *
 * @param cluster The name of the cluster to check.
 */
async function checkKnativeInstalled(cluster: string) {
  const now = Date.now();
  const fresh = now - (lastCheckedAt[cluster] ?? 0) < CHECK_TTL_MS;
  if (inFlight[cluster] || fresh) {
    return;
  }
  inFlight[cluster] = true;
  const [serving, eventing] = await Promise.all([
    isKnativeServingInstalled([cluster]),
    isKnativeEventingInstalled([cluster]),
  ]);
  servingInstalledByCluster[cluster] = serving;
  eventingInstalledByCluster[cluster] = eventing;
  lastCheckedAt[cluster] = Date.now();
  inFlight[cluster] = false;
}

registerSidebarEntryFilter(entry => {
  if (entry.name !== 'knative' && entry.parent !== 'knative') {
    return entry;
  }

  const cluster = Utils.getCluster() ?? '';
  void checkKnativeInstalled(cluster);

  const serving = servingInstalledByCluster[cluster];
  const eventing = eventingInstalledByCluster[cluster];

  // Undefined means the probe has not answered yet. Keep the entry visible so
  // the sidebar does not flicker on first paint.
  if (serving === undefined || eventing === undefined) {
    return entry;
  }

  // The parent needs either component.
  if (entry.name === 'knative') {
    return serving || eventing ? entry : null;
  }

  const needed = EVENTING_SIDEBAR_ENTRIES.has(entry.name) ? eventing : serving;
  return needed ? entry : null;
});

// Sidebar entries for Knative
registerSidebarEntry({
  parent: null,
  name: 'knative',
  label: 'Knative',
  icon: 'custom:knative',
  url: '/knative/services',
});

registerSidebarEntry({
  parent: 'knative',
  name: 'kservices',
  label: 'KServices',
  url: '/knative/services',
});

registerSidebarEntry({
  parent: 'knative',
  name: 'revisions',
  label: 'Revisions',
  url: '/knative/revisions',
});

registerSidebarEntry({
  parent: 'knative',
  name: 'domain-mappings',
  label: 'Domain Mapping',
  url: '/knative/domain-mappings',
});

registerSidebarEntry({
  parent: 'knative',
  name: 'cluster-domain-claims',
  label: 'Cluster Domain Claims',
  url: '/knative/cluster-domain-claims',
});

registerSidebarEntry({
  parent: 'knative',
  name: 'knetworking',
  label: 'Networking',
  url: '/knative/networking',
});

registerSidebarEntry({
  parent: 'knative',
  name: 'brokers',
  label: 'Brokers',
  url: '/knative/brokers',
});

registerSidebarEntry({
  parent: 'knative',
  name: 'triggers',
  label: 'Triggers',
  url: '/knative/triggers',
});

registerRoute({
  path: '/knative/services/:namespace/:name',
  sidebar: 'kservices',
  name: 'kserviceDetails',
  component: withQueryClient(KServiceDetail),
});

registerRoute({
  path: '/knative/services',
  sidebar: 'kservices',
  name: 'kservices',
  component: withQueryClient(KServicesList),
});

registerRoute({
  path: '/knative/revisions/:namespace/:name',
  sidebar: 'revisions',
  name: 'revisionDetails',
  component: withQueryClient(RevisionDetail),
});

registerRoute({
  path: '/knative/revisions',
  sidebar: 'revisions',
  name: 'revisions',
  component: withQueryClient(RevisionsList),
});

registerRoute({
  path: '/knative/domain-mappings',
  sidebar: 'domain-mappings',
  name: 'domainMappingList',
  component: withQueryClient(DomainMappingsList),
});

registerRoute({
  path: '/knative/cluster-domain-claims',
  sidebar: 'cluster-domain-claims',
  name: 'clusterDomainClaimsList',
  component: withQueryClient(ClusterDomainClaimsList),
});

registerRoute({
  path: '/knative/networking',
  sidebar: 'knetworking',
  name: 'knetworking',
  component: withQueryClient(NetworkingOverview),
});

registerRoute({
  path: '/knative/brokers',
  sidebar: 'brokers',
  name: 'knativeBrokers',
  component: withQueryClient(BrokersList),
});

registerRoute({
  path: '/knative/triggers',
  sidebar: 'triggers',
  name: 'knativeTriggers',
  component: withQueryClient(TriggersList),
});

registerMapSource(knativePluginSource);
registerMapSource(knativeEventingSource);

// Trigger detail pages use Headlamp's generic Custom Resource view, so the event
// routing summary is injected into it rather than owning a route.
registerDetailsViewSection((props: DetailsViewSectionProps) => (
  <TriggerDetailsSection {...props} />
));

registerKindIcon('serving.knative.dev/Service', {
  icon: <Icon icon="custom:knative" width="70%" height="70%" />,
  color: 'rgb(7, 102, 174)',
});

registerKindIcon('Revision', {
  icon: <Icon icon="custom:knative" width="70%" height="70%" />,
  color: 'rgb(7, 102, 174)',
});

registerKindIcon('DomainMapping', {
  icon: <Icon icon="custom:knative" width="70%" height="70%" />,
  color: 'rgb(7, 102, 174)',
});

registerKindIcon('ClusterDomainClaim', {
  icon: <Icon icon="custom:knative" width="70%" height="70%" />,
  color: 'rgb(50, 108, 229)',
});

registerKindIcon('eventing.knative.dev/Broker', {
  icon: <Icon icon="custom:knative" width="70%" height="70%" />,
  color: 'rgb(7, 102, 174)',
});

registerKindIcon('eventing.knative.dev/Trigger', {
  icon: <Icon icon="custom:knative" width="70%" height="70%" />,
  color: 'rgb(7, 102, 174)',
});

// Register on-hover "glance" tooltips for the map view
import { ClusterDomainClaimGlance } from './components/clusterdomainclaims/Glance';
import { DomainMappingGlance } from './components/domainmappings/Glance';
import { KServiceGlance } from './components/kservices/Glance';
import { RevisionGlance } from './components/revisions/Glance';
registerKubeObjectGlance({ id: 'knative-kservice-glance', component: KServiceGlance });
registerKubeObjectGlance({ id: 'knative-revision-glance', component: RevisionGlance });
registerKubeObjectGlance({ id: 'knative-domain-mapping-glance', component: DomainMappingGlance });
registerKubeObjectGlance({
  id: 'knative-cluster-domain-claim-glance',
  component: ClusterDomainClaimGlance,
});
