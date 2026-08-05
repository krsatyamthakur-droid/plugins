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
import type { Condition } from '../common';
import {
  type Addressable,
  BROKER_CLASS_ANNOTATION,
  type DeliverySpec,
  type Destination,
  EVENTING_API_VERSION,
  type KReference,
} from './common';
import { getEventingDetailsLink } from './links';

interface BrokerResource extends KubeObjectInterface {
  spec?: {
    /** Points at implementation config, usually a ConfigMap. */
    config?: KReference;
    /** Default delivery for every Trigger on this Broker. Triggers may override it. */
    delivery?: DeliverySpec;
  };
  status?: {
    address?: Addressable;
    addresses?: Addressable[];
    conditions?: Condition[];
    deadLetterSinkUri?: string;
    observedGeneration?: number;
  };
}

/**
 * A Knative Eventing Broker: the event mesh endpoint senders POST to, and the
 * pool Triggers subscribe to.
 */
export class Broker extends KubeObject<BrokerResource> {
  static kind = 'Broker';
  static apiName = 'brokers';
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
      apiName: Broker.apiName,
      apiVersion: Broker.apiVersion,
      name: this.getName(),
      namespace: this.getNamespace(),
      cluster: this.cluster,
    });
  }

  /**
   * The ingress URL senders POST CloudEvents to. Absent until the Broker is
   * reconciled, which is the normal state for the first few seconds.
   */
  get address(): string | undefined {
    return this.status?.address?.url;
  }

  /**
   * The Broker implementation, read off the `eventing.knative.dev/broker.class`
   * annotation. It is an annotation rather than a spec field, so a Broker
   * created before the annotation was defaulted will report undefined.
   */
  get brokerClass(): string | undefined {
    return this.metadata.annotations?.[BROKER_CLASS_ANNOTATION];
  }

  get deadLetterSink(): Destination | undefined {
    return this.spec?.delivery?.deadLetterSink;
  }

  /** Resolved dead letter sink URL, populated by the reconciler. */
  get deadLetterSinkUri(): string | undefined {
    return this.status?.deadLetterSinkUri;
  }

  get isReady(): boolean {
    return this.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True';
  }

  get readyCondition(): Condition | undefined {
    return this.status?.conditions?.find(c => c.type === 'Ready');
  }
}
