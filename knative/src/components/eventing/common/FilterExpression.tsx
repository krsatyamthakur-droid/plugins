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

import { Alert, Box, Chip, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import type { FilterView, SubscriptionsAPIFilter } from '../../../utils/triggerFilter';

const OPERATOR_LABELS: Record<string, string> = {
  exact: 'is',
  prefix: 'starts with',
  suffix: 'ends with',
};

function MatchRow({
  attribute,
  operator,
  value,
}: {
  attribute: string;
  operator: string;
  value: string;
}) {
  return (
    <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
      <Chip label={attribute} size="small" variant="outlined" />
      <Typography variant="body2" color="text.secondary">
        {OPERATOR_LABELS[operator] ?? operator}
      </Typography>
      <Typography variant="body2" component="code" sx={{ fontFamily: 'monospace' }}>
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Renders one node of a Subscriptions API filter expression, recursing into
 * `all`, `any` and `not` branches.
 *
 * Nesting is drawn with an indent and a left rule rather than with brackets,
 * because these trees are usually two levels deep and a bracketed one-liner
 * stops being readable at the first `any` inside an `all`.
 */
function FilterNode({ filter }: { filter: SubscriptionsAPIFilter }) {
  const nested = (label: string, children: SubscriptionsAPIFilter[]) => (
    <Box>
      <Typography variant="caption" color="text.secondary" textTransform="uppercase">
        {label}
      </Typography>
      <Box sx={{ pl: 1.5, ml: 0.5, borderLeft: 2, borderColor: 'divider', mt: 0.5 }}>
        {children.map((child, index) => (
          <Box key={index} sx={{ my: 0.5 }}>
            <FilterNode filter={child} />
          </Box>
        ))}
      </Box>
    </Box>
  );

  if (filter.all) {
    return nested('All of', filter.all);
  }

  if (filter.any) {
    return nested('Any of', filter.any);
  }

  if (filter.not) {
    return nested('Not', [filter.not]);
  }

  if (filter.cesql) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" textTransform="uppercase">
          CESQL
        </Typography>
        <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', m: 0 }}>
          {filter.cesql}
        </Typography>
      </Box>
    );
  }

  const rows: ReactNode[] = [];
  for (const operator of ['exact', 'prefix', 'suffix'] as const) {
    for (const [attribute, value] of Object.entries(filter[operator] ?? {})) {
      rows.push(
        <MatchRow
          key={`${operator}-${attribute}`}
          attribute={attribute}
          operator={operator}
          value={value}
        />
      );
    }
  }

  if (rows.length === 0) {
    // Schema-valid but semantically empty. Worth showing rather than hiding,
    // since it usually means a typo in the operator name.
    return (
      <Typography variant="body2" color="warning.main">
        Empty filter expression, no operator set
      </Typography>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={0.5}>
      {rows}
    </Box>
  );
}

/**
 * Renders a Trigger's effective filtering.
 *
 * The three modes come from `buildFilterView`, which applies the CRD's own
 * precedence rule. When a Trigger sets both fields the legacy one is shown as a
 * warning rather than as data, because the data plane ignores it and an
 * operator reading the YAML would reasonably assume otherwise.
 */
export function FilterExpression({ view }: { view: FilterView }) {
  if (view.mode === 'all-events') {
    return (
      <Typography variant="body2" color="text.secondary">
        No filter set, every event on the Broker is delivered.
      </Typography>
    );
  }

  if (view.mode === 'attributes') {
    return (
      <Box display="flex" flexDirection="column" gap={1}>
        <Alert severity="info" sx={{ py: 0 }}>
          Uses the legacy <code>spec.filter</code> field. Exact match on every attribute below.
        </Alert>
        <Box display="flex" flexDirection="column" gap={0.5}>
          {Object.entries(view.attributes).map(([attribute, value]) => (
            <MatchRow key={attribute} attribute={attribute} operator="exact" value={value} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={1}>
      {view.legacyOverridden && (
        <Alert severity="warning" sx={{ py: 0 }}>
          This Trigger also sets <code>spec.filter</code>, which is ignored because{' '}
          <code>spec.filters</code> overrides it.
        </Alert>
      )}
      {view.filters.length > 1 && (
        <Typography variant="caption" color="text.secondary">
          All {view.filters.length} expressions must match.
        </Typography>
      )}
      <Box display="flex" flexDirection="column" gap={1}>
        {view.filters.map((filter, index) => (
          <FilterNode key={index} filter={filter} />
        ))}
      </Box>
    </Box>
  );
}
