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

import { Router } from '@kinvolk/headlamp-plugin/lib';
import { formatClusterPathParam, getSelectedClusters } from '@kinvolk/headlamp-plugin/lib/cluster';

/**
 * Builds the `<plural>.<group>` CRD identifier Headlamp's custom resource
 * routes expect, for example `triggers.eventing.knative.dev`.
 */
function getCrdName(apiName: string, apiVersion: string): string {
  const group = apiVersion.includes('/') ? apiVersion.split('/')[0] : '';
  return group ? `${apiName}.${group}` : apiName;
}

/**
 * Route to Headlamp's generic CRD detail view for one Eventing object.
 *
 * The Eventing views are read-only for now, so they reuse Headlamp's built-in
 * custom resource pages rather than registering plugin-owned detail routes.
 * DomainMapping and ClusterDomainClaim already do the same thing.
 *
 * The cluster path segment goes through `formatClusterPathParam`, because with
 * several clusters selected Headlamp's routes expect `a+b`, not a bare cluster
 * name. Passing `this.cluster` straight through produces a link that 404s in
 * multi-cluster mode. `KubeObject.getDetailsLink` does the same thing for
 * built-in kinds.
 */
export function getEventingDetailsLink(options: {
  apiName: string;
  apiVersion: string;
  name: string;
  namespace?: string;
  cluster?: string;
}): string {
  return Router.createRouteURL('customresource', {
    cluster: formatClusterPathParam(getSelectedClusters(), options.cluster),
    crd: getCrdName(options.apiName, options.apiVersion),
    namespace: options.namespace || '-',
    crName: options.name,
  });
}
