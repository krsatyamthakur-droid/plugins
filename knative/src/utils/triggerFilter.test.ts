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

import { buildFilterView, summarizeFilter } from './triggerFilter';

describe('buildFilterView', () => {
  it('reports all-events when neither field is set', () => {
    expect(buildFilterView(undefined)).toEqual({ mode: 'all-events' });
    expect(buildFilterView({})).toEqual({ mode: 'all-events' });
  });

  it('uses the legacy attributes when only filter is set', () => {
    expect(buildFilterView({ filter: { attributes: { type: 'order.created' } } })).toEqual({
      mode: 'attributes',
      attributes: { type: 'order.created' },
    });
  });

  it('uses the expressions when only filters is set', () => {
    const filters = [{ exact: { type: 'order.created' } }];
    expect(buildFilterView({ filters })).toEqual({
      mode: 'expressions',
      filters,
      legacyOverridden: false,
    });
  });

  it('lets filters override filter and flags the override', () => {
    const view = buildFilterView({
      filter: { attributes: { type: 'stale.type' } },
      filters: [{ exact: { type: 'order.created' } }],
    });

    expect(view).toMatchObject({ mode: 'expressions', legacyOverridden: true });
  });

  it('treats an empty filters array as all-events, not as a deny-all', () => {
    // The CRD documents "Absence of a filter or empty array implies a value of true".
    expect(buildFilterView({ filters: [] })).toEqual({ mode: 'all-events' });
  });

  it('does not let an empty filters array suppress a populated legacy filter', () => {
    expect(
      buildFilterView({ filter: { attributes: { type: 'order.created' } }, filters: [] })
    ).toEqual({ mode: 'attributes', attributes: { type: 'order.created' } });
  });

  it('treats empty attributes as all-events', () => {
    expect(buildFilterView({ filter: { attributes: {} } })).toEqual({ mode: 'all-events' });
    expect(buildFilterView({ filter: {} })).toEqual({ mode: 'all-events' });
  });
});

describe('summarizeFilter', () => {
  it('summarizes all-events', () => {
    expect(summarizeFilter({ mode: 'all-events' })).toBe('All events');
  });

  it('joins legacy attributes as key=value pairs', () => {
    expect(
      summarizeFilter({
        mode: 'attributes',
        attributes: { type: 'order.created', source: '/shop' },
      })
    ).toBe('type=order.created, source=/shop');
  });

  it('names the operator for a single expression', () => {
    expect(
      summarizeFilter({
        mode: 'expressions',
        filters: [{ prefix: { type: 'order.' } }],
        legacyOverridden: false,
      })
    ).toBe('type prefix order.');
  });

  it('counts nested branches rather than expanding them', () => {
    expect(
      summarizeFilter({
        mode: 'expressions',
        filters: [{ any: [{ exact: { type: 'a' } }, { exact: { type: 'b' } }] }],
        legacyOverridden: false,
      })
    ).toBe('any(2)');
  });

  it('describes a negated expression', () => {
    expect(
      summarizeFilter({
        mode: 'expressions',
        filters: [{ not: { exact: { type: 'internal.ping' } } }],
        legacyOverridden: false,
      })
    ).toBe('not(type exact internal.ping)');
  });

  it('labels CESQL without trying to parse it', () => {
    expect(
      summarizeFilter({
        mode: 'expressions',
        filters: [{ cesql: "source LIKE '/shop/%'" }],
        legacyOverridden: false,
      })
    ).toBe('CESQL');
  });

  it('joins multiple top-level expressions, which the API ANDs together', () => {
    expect(
      summarizeFilter({
        mode: 'expressions',
        filters: [{ exact: { type: 'order.created' } }, { prefix: { source: '/shop' } }],
        legacyOverridden: false,
      })
    ).toBe('all of: type exact order.created, source prefix /shop');
  });

  it('does not crash on a node with no recognised operator', () => {
    expect(summarizeFilter({ mode: 'expressions', filters: [{}], legacyOverridden: false })).toBe(
      'unknown'
    );
  });
});
