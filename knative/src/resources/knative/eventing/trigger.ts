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

import { KubeObject, type KubeObjectInterface } from '@kinvolk/headlamp-plugin/lib/k8s/cluster';
import { resolveBrokerRef, type TriggerBrokerSpec } from '../../../utils/brokerRef';
import {
  buildFilterView,
  type FilterView,
  type TriggerFilterSpec,
} from '../../../utils/triggerFilter';
import type { Condition } from '../common';
import { type DeliverySpec, type Destination, EVENTING_API_VERSION } from './common';
import { getEventingDetailsLink } from './links';

interface TriggerResource extends KubeObjectInterface {
  spec?: TriggerFilterSpec &
    TriggerBrokerSpec & {
      delivery?: DeliverySpec;
      subscriber?: Destination;
    };
  status?: {
    conditions?: Condition[];
    subscriberUri?: string;
    subscriberCACerts?: string;
    deadLetterSinkUri?: string;
    observedGeneration?: number;
  };
}

/**
 * A Knative Eventing Trigger: a filtered subscription from a Broker's event
 * pool to one subscriber.
 */
export class Trigger extends KubeObject<TriggerResource> {
  static kind = 'Trigger';
  static apiName = 'triggers';
  static apiVersion = EVENTING_API_VERSION;
  static isNamespaced = true;

  get metadata() {
    return this.jsonData.metadata;
  }

  get spec() {
    return this.jsonData.spec;
  }

  get status() {
    return this.jsonData.status;
  }

  getDetailsLink(): string {
    return getEventingDetailsLink({
      apiName: Trigger.apiName,
      apiVersion: Trigger.apiVersion,
      name: this.getName(),
      namespace: this.getNamespace(),
      cluster: this.cluster,
    });
  }

  /**
   * Which Broker this Trigger reads from, with the `brokerRef` over `broker`
   * precedence applied. See `resolveBrokerRef` for why it lives outside this class.
   */
  private get resolvedBroker() {
    return resolveBrokerRef(this.spec, this.getNamespace() || '');
  }

  get brokerName(): string | undefined {
    return this.resolvedBroker.name;
  }

  get brokerNamespace(): string {
    return this.resolvedBroker.namespace;
  }

  /** True when the Broker lives in a different namespace than the Trigger. */
  get isCrossNamespace(): boolean {
    return this.resolvedBroker.isCrossNamespace;
  }

  get subscriber(): Destination | undefined {
    return this.spec?.subscriber;
  }

  /** Resolved subscriber URL, populated by the reconciler once it resolves. */
  get subscriberUri(): string | undefined {
    return this.status?.subscriberUri;
  }

  get deadLetterSink(): Destination | undefined {
    return this.spec?.delivery?.deadLetterSink;
  }

  /** Which of the two filter fields is actually in effect. */
  get filterView(): FilterView {
    return buildFilterView(this.spec);
  }

  get isReady(): boolean {
    return this.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True';
  }

  get readyCondition(): Condition | undefined {
    return this.status?.conditions?.find(c => c.type === 'Ready');
  }

  /**
   * True when the API server accepted the Trigger but the subscriber could not
   * be resolved, which is the most common silent failure in an Eventing setup.
   */
  get hasUnresolvedSubscriber(): boolean {
    const resolved = this.status?.conditions?.find(c => c.type === 'SubscriberResolved');
    return resolved?.status === 'False';
  }
}
