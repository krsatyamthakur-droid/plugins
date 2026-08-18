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

import { DetailsGrid } from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import { useParams } from 'react-router-dom';
import { Trigger } from '../../../resources/knative/eventing';

/**
 * Plugin-owned detail page for a Trigger.
 *
 * The event routing summary itself lives in TriggerDetailsSection, registered
 * through `registerDetailsViewSection`. That registration renders here, on a
 * plugin-owned DetailsGrid page, but not on Headlamp's generic Custom Resource
 * page, which is why Triggers need a route of their own rather than relying on
 * the generic page the way Brokers do.
 */
export function TriggerDetail() {
  const { name, namespace } = useParams<{ namespace: string; name: string }>();

  return <DetailsGrid resourceType={Trigger} name={name} namespace={namespace} withEvents />;
}
