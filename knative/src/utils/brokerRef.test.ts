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

import { resolveBrokerRef } from './brokerRef';

describe('resolveBrokerRef', () => {
  it('reads spec.broker in the Trigger namespace when there is no brokerRef', () => {
    expect(resolveBrokerRef({ broker: 'default' }, 'shop')).toEqual({
      name: 'default',
      namespace: 'shop',
      isCrossNamespace: false,
    });
  });

  it('prefers spec.brokerRef.name over spec.broker', () => {
    expect(
      resolveBrokerRef({ broker: 'legacy', brokerRef: { name: 'shared' } }, 'shop')
    ).toMatchObject({ name: 'shared' });
  });

  it('keeps the spec.broker name when brokerRef only carries a namespace', () => {
    // filter_handler.go falls back to Spec.Broker when BrokerRef.Name is empty,
    // but still moves the lookup to BrokerRef.Namespace.
    expect(
      resolveBrokerRef({ broker: 'default', brokerRef: { namespace: 'platform' } }, 'shop')
    ).toEqual({ name: 'default', namespace: 'platform', isCrossNamespace: true });
  });

  it('does not call a same-namespace brokerRef cross-namespace', () => {
    expect(
      resolveBrokerRef({ brokerRef: { name: 'default', namespace: 'shop' } }, 'shop')
    ).toMatchObject({ isCrossNamespace: false });
  });

  it('reports no name when neither field is set', () => {
    expect(resolveBrokerRef({}, 'shop')).toEqual({
      name: undefined,
      namespace: 'shop',
      isCrossNamespace: false,
    });
    expect(resolveBrokerRef(undefined, 'shop')).toMatchObject({ name: undefined });
  });

  it('tolerates a Trigger with no namespace', () => {
    expect(resolveBrokerRef({ broker: 'default' }, '')).toMatchObject({ namespace: '' });
  });
});
