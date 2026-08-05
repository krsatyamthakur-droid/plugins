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

import { CustomResourceDefinition } from './resources/k8s/customResourceDefinition';

const KNATIVE_SERVING_KSERVICE_CRD_NAME = 'services.serving.knative.dev';
const KNATIVE_EVENTING_BROKER_CRD_NAME = 'brokers.eventing.knative.dev';

function hasCrdInCluster(cluster: string, crdName: string): Promise<boolean> {
  return new Promise(resolve => {
    let cancelFn: (() => void) | null = null;
    let settled = false;

    function settle(result: boolean) {
      if (settled) {
        return;
      }
      settled = true;
      resolve(result);
      if (cancelFn) {
        cancelFn();
      }
    }

    const request = CustomResourceDefinition.apiGet(
      () => settle(true),
      crdName,
      undefined,
      () => settle(false),
      { cluster }
    );

    request()
      .then(cancel => {
        cancelFn = cancel;
      })
      .catch(() => {
        settle(false);
      });
  });
}

async function hasCrdInEveryCluster(clusters: string[], crdName: string): Promise<boolean> {
  if (!clusters || clusters.length === 0) {
    return false;
  }

  const results = await Promise.all(clusters.map(cluster => hasCrdInCluster(cluster, crdName)));

  // Consider the component "installed" only if it exists in all selected clusters.
  return results.every(Boolean);
}

/**
 * Whether Knative Serving is installed, detected via the KService CRD.
 */
export function isKnativeServingInstalled(clusters: string[]): Promise<boolean> {
  return hasCrdInEveryCluster(clusters, KNATIVE_SERVING_KSERVICE_CRD_NAME);
}

/**
 * Whether Knative Eventing is installed, detected via the Broker CRD.
 *
 * Eventing ships in its own release YAML and does not depend on Serving, so a
 * cluster can have one, the other, or both. Probing only the Serving CRD, as
 * this module used to, hid the whole plugin on Eventing-only clusters.
 */
export function isKnativeEventingInstalled(clusters: string[]): Promise<boolean> {
  return hasCrdInEveryCluster(clusters, KNATIVE_EVENTING_BROKER_CRD_NAME);
}

/**
 * Whether any part of Knative is installed. Used for the top-level sidebar
 * entry, where either component is reason enough to show the menu.
 */
export async function isKnativeInstalled(clusters: string[]): Promise<boolean> {
  const [serving, eventing] = await Promise.all([
    isKnativeServingInstalled(clusters),
    isKnativeEventingInstalled(clusters),
  ]);

  return serving || eventing;
}
