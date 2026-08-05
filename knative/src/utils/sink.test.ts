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

import { describeSink, resolveSink } from './sink';

describe('resolveSink', () => {
  it('resolves a ref to an object target', () => {
    const result = resolveSink(
      { ref: { apiVersion: 'serving.knative.dev/v1', kind: 'Service', name: 'processor' } },
      'default'
    );

    expect(result).toEqual({
      kind: 'object',
      ref: { apiVersion: 'serving.knative.dev/v1', kind: 'Service', name: 'processor' },
      namespace: 'default',
      uri: undefined,
    });
  });

  it('defaults a ref without a namespace to the owner namespace', () => {
    const result = resolveSink({ ref: { kind: 'Service', name: 'processor' } }, 'events');
    expect(result).toMatchObject({ kind: 'object', namespace: 'events' });
  });

  it('keeps an explicit cross-namespace ref', () => {
    const result = resolveSink(
      { ref: { kind: 'Broker', name: 'default', namespace: 'shared' } },
      'events'
    );
    expect(result).toMatchObject({ kind: 'object', namespace: 'shared' });
  });

  it('prefers the ref when both ref and uri are set', () => {
    const result = resolveSink(
      { ref: { kind: 'Service', name: 'processor' }, uri: 'https://example.com/hook' },
      'default'
    );

    expect(result.kind).toBe('object');
    // The uri is kept, since it is resolved relative to the ref's address.
    expect(result).toMatchObject({ uri: 'https://example.com/hook' });
  });

  it('resolves a bare uri', () => {
    expect(resolveSink({ uri: 'https://example.com/hook' }, 'default')).toEqual({
      kind: 'uri',
      uri: 'https://example.com/hook',
    });
  });

  it('rejects a uri with an unsafe scheme', () => {
    expect(resolveSink({ uri: 'javascript:alert(1)' }, 'default')).toEqual({ kind: 'unresolved' });
  });

  it('treats a ref with no name as unresolved', () => {
    expect(resolveSink({ ref: { kind: 'Service' } }, 'default')).toEqual({ kind: 'unresolved' });
  });

  it('handles a missing destination', () => {
    expect(resolveSink(undefined, 'default')).toEqual({ kind: 'unresolved' });
    expect(resolveSink({}, 'default')).toEqual({ kind: 'unresolved' });
  });
});

describe('describeSink', () => {
  it('labels a same-namespace object without repeating the namespace', () => {
    expect(describeSink({ ref: { kind: 'Service', name: 'processor' } }, 'default')).toBe(
      'Service/processor'
    );
  });

  it('shows the namespace when the sink is in another one', () => {
    expect(
      describeSink({ ref: { kind: 'Broker', name: 'default', namespace: 'shared' } }, 'events')
    ).toBe('Broker/default (shared)');
  });

  it('falls back to Object when the ref has no kind', () => {
    expect(describeSink({ ref: { name: 'processor' } }, 'default')).toBe('Object/processor');
  });

  it('returns the uri for uri sinks and undefined for unresolved ones', () => {
    expect(describeSink({ uri: 'https://example.com/hook' }, 'default')).toBe(
      'https://example.com/hook'
    );
    expect(describeSink(undefined, 'default')).toBeUndefined();
  });
});
