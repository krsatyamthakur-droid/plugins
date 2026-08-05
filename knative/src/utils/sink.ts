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

import type { Destination, KReference } from '../resources/knative/eventing/common';
import { getSafeUrl } from './url';

/**
 * What a Destination points at, once the ref/uri combination has been worked out.
 *
 * - `object`: there is a ref, so the target is a Kubernetes object we can link to.
 * - `uri`: there is only a uri, so the target is outside the cluster's object graph.
 * - `unresolved`: neither, which means the resource is misconfigured.
 */
export type ResolvedSink =
  | {
      kind: 'object';
      ref: Required<Pick<KReference, 'name'>> & KReference;
      namespace: string;
      uri?: string;
    }
  | { kind: 'uri'; uri: string }
  | { kind: 'unresolved' };

/**
 * Resolves a Destination to something the UI can render and the map can link.
 *
 * A `ref` wins over a `uri` when both are present, because in that case the
 * spec treats the uri as relative to the address the ref resolves to. A ref
 * with no namespace defaults to the namespace of the object holding it, which
 * is why the owner's namespace has to be passed in.
 *
 * A uri that is not http or https is dropped rather than rendered, since these
 * strings are user-controlled and end up in an anchor href.
 *
 * @param destination The Destination from a spec field such as `spec.subscriber`.
 * @param ownerNamespace Namespace of the resource that owns the Destination.
 */
export function resolveSink(
  destination: Destination | undefined,
  ownerNamespace: string
): ResolvedSink {
  const ref = destination?.ref;

  if (ref?.name) {
    return {
      kind: 'object',
      ref: { ...ref, name: ref.name },
      namespace: ref.namespace || ownerNamespace,
      uri: getSafeUrl(destination?.uri),
    };
  }

  const uri = getSafeUrl(destination?.uri);
  if (uri) {
    return { kind: 'uri', uri };
  }

  return { kind: 'unresolved' };
}

/**
 * Short human-readable label for a Destination, for list columns and map nodes.
 * Returns undefined when the destination cannot be resolved, so callers can
 * decide between a dash and a warning.
 */
export function describeSink(
  destination: Destination | undefined,
  ownerNamespace: string
): string | undefined {
  const resolved = resolveSink(destination, ownerNamespace);

  if (resolved.kind === 'object') {
    const kind = resolved.ref.kind || 'Object';
    const crossNamespace = resolved.namespace !== ownerNamespace;
    return crossNamespace
      ? `${kind}/${resolved.ref.name} (${resolved.namespace})`
      : `${kind}/${resolved.ref.name}`;
  }

  if (resolved.kind === 'uri') {
    return resolved.uri;
  }

  return undefined;
}
