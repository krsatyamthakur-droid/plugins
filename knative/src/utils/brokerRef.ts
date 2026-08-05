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

import type { KReference } from '../resources/knative/eventing/common';

/** The two ways a Trigger can name its Broker. */
export interface TriggerBrokerSpec {
  /** Broker name, resolved in the Trigger's own namespace. */
  broker?: string;
  /** Cross-namespace Broker reference, gated by the cross-namespace-event-links feature. */
  brokerRef?: KReference;
}

export interface ResolvedBrokerRef {
  name?: string;
  namespace: string;
  /** True when the Broker is in a different namespace than the Trigger. */
  isCrossNamespace: boolean;
}

/**
 * Works out which Broker a Trigger reads from.
 *
 * Mirrors the precedence in the data plane's filter handler
 * (`pkg/broker/filter/filter_handler.go`): `spec.brokerRef.name` wins over
 * `spec.broker`, and a `brokerRef` with a namespace but no name still moves the
 * lookup to that namespace while keeping the name from `spec.broker`.
 *
 * One deliberate difference from the data plane: it only consults `brokerRef`
 * when the `cross-namespace-event-links` feature is enabled, and the UI cannot
 * know that without reading the `config-features` ConfigMap. Showing what the
 * user wrote is the more useful default. On a cluster without the feature, such
 * a Trigger reports Ready=False anyway, which is the real signal.
 *
 * This lives outside the Trigger class so it can be unit tested. Anything that
 * imports `@kinvolk/headlamp-plugin/lib/k8s/cluster` cannot be, because the
 * shared vitest config has no alias for the `lib/...` import form the published
 * package expects (the files actually sit under `lib/lib/...`).
 */
export function resolveBrokerRef(
  spec: TriggerBrokerSpec | undefined,
  ownNamespace: string
): ResolvedBrokerRef {
  const refNamespace = spec?.brokerRef?.namespace;
  const namespace = refNamespace || ownNamespace;

  return {
    name: spec?.brokerRef?.name || spec?.broker,
    namespace,
    isCrossNamespace: !!refNamespace && refNamespace !== ownNamespace,
  };
}
