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

import { Tooltip, Typography } from '@mui/material';
import type { Destination } from '../../../resources/knative/eventing';
import { describeSink, resolveSink } from '../../../utils/sink';

/**
 * Table cell for a Destination.
 *
 * An unresolvable destination renders in the warning colour rather than as a
 * dash. A Trigger whose subscriber never resolved is the single most common
 * Eventing failure, and a dash makes it look like an empty optional field.
 */
export function SinkCell({
  destination,
  ownerNamespace,
}: {
  destination: Destination | undefined;
  ownerNamespace: string;
}) {
  const label = describeSink(destination, ownerNamespace);

  if (!label) {
    const wasSet = !!destination && (!!destination.ref || !!destination.uri);
    return (
      <Tooltip title={wasSet ? 'Sink is set but could not be resolved' : 'No sink configured'}>
        <Typography variant="body2" color={wasSet ? 'warning.main' : 'text.secondary'}>
          {wasSet ? 'Unresolved' : '-'}
        </Typography>
      </Tooltip>
    );
  }

  const resolved = resolveSink(destination, ownerNamespace);
  const tooltip =
    resolved.kind === 'object' && resolved.ref.apiVersion
      ? `${resolved.ref.apiVersion} ${resolved.ref.kind}/${resolved.ref.name}`
      : label;

  return (
    <Tooltip title={tooltip}>
      <Typography variant="body2" noWrap sx={{ maxWidth: 320 }}>
        {label}
      </Typography>
    </Tooltip>
  );
}
