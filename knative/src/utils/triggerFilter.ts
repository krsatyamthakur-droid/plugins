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
 * One node of the CloudEvents Subscriptions API filter dialect, as accepted by
 * `Trigger.spec.filters`. Every field is optional and a node normally sets
 * exactly one of them.
 *
 * @see https://github.com/cloudevents/spec/blob/main/subscriptions/spec.md#324-filters
 */
export interface SubscriptionsAPIFilter {
  all?: SubscriptionsAPIFilter[];
  any?: SubscriptionsAPIFilter[];
  not?: SubscriptionsAPIFilter;
  exact?: Record<string, string>;
  prefix?: Record<string, string>;
  suffix?: Record<string, string>;
  cesql?: string;
}

/**
 * The two filter fields a Trigger spec can carry.
 */
export interface TriggerFilterSpec {
  /** Legacy exact-match filter. Superseded by `filters`. */
  filter?: { attributes?: Record<string, string> };
  /** Expression filter. Overrides `filter` when both are set. */
  filters?: SubscriptionsAPIFilter[];
}

/**
 * What the UI should draw for a Trigger's filtering.
 *
 * `legacyOverridden` is true when the Trigger also sets the old `filter` field,
 * which the API server accepts but the data plane ignores. Surfacing that is
 * the whole point of this type: a Trigger with a stale `filter` looks like it
 * filters on those attributes and does not.
 */
export type FilterView =
  | { mode: 'expressions'; filters: SubscriptionsAPIFilter[]; legacyOverridden: boolean }
  | { mode: 'attributes'; attributes: Record<string, string> }
  | { mode: 'all-events' };

/**
 * Works out which filter field is actually in effect on a Trigger.
 *
 * The precedence is the CRD's own, quoted from `trigger.yaml`: "In the event of
 * users specifying both Filter and Filters, then the latter will override the
 * former."
 *
 * An empty `filters: []` means "allow everything" rather than "allow nothing",
 * so it is reported as `all-events` and does not suppress a populated legacy
 * `filter`. An empty `filter.attributes: {}` is treated the same way.
 */
export function buildFilterView(spec: TriggerFilterSpec | undefined): FilterView {
  const filters = spec?.filters;
  const attributes = spec?.filter?.attributes;
  const hasLegacy = !!attributes && Object.keys(attributes).length > 0;

  if (filters && filters.length > 0) {
    return { mode: 'expressions', filters, legacyOverridden: hasLegacy };
  }

  if (hasLegacy) {
    return { mode: 'attributes', attributes: attributes! };
  }

  return { mode: 'all-events' };
}

/**
 * One-line summary of a filter, for the Triggers list column where a tree does
 * not fit. Deliberately lossy: it names the outermost operator and the number
 * of conditions rather than trying to render nested logic in a table cell.
 */
export function summarizeFilter(view: FilterView): string {
  if (view.mode === 'all-events') {
    return 'All events';
  }

  if (view.mode === 'attributes') {
    return Object.entries(view.attributes)
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
  }

  const parts = view.filters.map(summarizeExpression);
  return parts.length === 1 ? parts[0] : `all of: ${parts.join(', ')}`;
}

function summarizeExpression(filter: SubscriptionsAPIFilter): string {
  if (filter.all) {
    return `all(${filter.all.length})`;
  }
  if (filter.any) {
    return `any(${filter.any.length})`;
  }
  if (filter.not) {
    return `not(${summarizeExpression(filter.not)})`;
  }
  if (filter.cesql) {
    return 'CESQL';
  }

  for (const op of ['exact', 'prefix', 'suffix'] as const) {
    const entries = Object.entries(filter[op] ?? {});
    if (entries.length > 0) {
      return entries.map(([key, value]) => `${key} ${op} ${value}`).join(', ');
    }
  }

  // A node with no recognised operator. Valid YAML, meaningless filter.
  return 'unknown';
}
