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

/**
 * A KReference, Knative's object reference. Unlike a core ObjectReference it
 * carries no uid or resourceVersion, and the namespace defaults to the
 * namespace of the object holding it.
 *
 * @see https://github.com/knative/eventing/blob/main/config/core/resources/broker.yaml
 */
export interface KReference {
  apiVersion?: string;
  kind?: string;
  name?: string;
  namespace?: string;
}

/**
 * A duckv1.Destination: where events go. Either a `ref` to an Addressable, a
 * `uri`, or both, in which case the uri is resolved relative to the ref.
 */
export interface Destination {
  ref?: KReference;
  uri?: string;
  /** CA certificates in PEM format that the sender trusts for this sink. */
  CACerts?: string;
  /** OIDC audience, only needed when the target is not itself Addressable. */
  audience?: string;
}

/**
 * A duckv1.DeliverySpec. Shared by Broker, Trigger, Channel and Subscription,
 * where the Trigger's copy overrides the Broker's for that Trigger only.
 */
export interface DeliverySpec {
  deadLetterSink?: Destination;
  /** Minimum retries before an event is moved to the dead letter sink. */
  retry?: number;
  backoffPolicy?: 'linear' | 'exponential';
  /** ISO-8601 duration, for example PT0.2S. */
  backoffDelay?: string;
  format?: 'json' | 'binary';
}

/**
 * An Addressable status field. Brokers and Channels expose one so that senders
 * can POST CloudEvents at them without knowing the routing strategy.
 */
export interface Addressable {
  name?: string;
  url?: string;
  CACerts?: string;
  audience?: string;
}

/** API group and version for the core Eventing resources. */
export const EVENTING_API_VERSION = 'eventing.knative.dev/v1';

/**
 * Annotation carrying the Broker implementation class, for example
 * `MTChannelBasedBroker` or `Kafka`. Not part of the spec, which is why it
 * has to be read off the annotations rather than a typed field.
 */
export const BROKER_CLASS_ANNOTATION = 'eventing.knative.dev/broker.class';
