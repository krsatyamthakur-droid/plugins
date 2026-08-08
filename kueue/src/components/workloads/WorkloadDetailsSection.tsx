import type { DetailsViewSectionProps } from '@kinvolk/headlamp-plugin/lib';
import type { WorkloadStatusLike } from '../../resources/workloadLifecycle';
import { kueueApiGroup } from '../../utils/kueueApi';
import EvictionSummary from './EvictionSummary';
import LifecycleSection from './LifecycleSection';

/**
 * Injects the lifecycle and eviction views into Headlamp's generic Custom
 * Resource detail page for Kueue Workloads.
 *
 * Going through `registerDetailsViewSection` rather than a plugin-owned route
 * means this works today, on any cluster running Kueue, without waiting for
 * the Workload list and detail pages to land. When those pages arrive the same
 * two components drop straight into them, since both take a plain status
 * object rather than a Workload instance.
 *
 * Matching on the API group rather than the exact version, because the plugin
 * supports both `v1beta2` and `v1beta1` and the fields read here exist in both.
 */
export default function WorkloadDetailsSection({ resource }: DetailsViewSectionProps) {
  const jsonData = resource?.jsonData as
    | { kind?: string; apiVersion?: string; status?: WorkloadStatusLike }
    | undefined;

  if (jsonData?.kind !== 'Workload' || !jsonData?.apiVersion?.startsWith(`${kueueApiGroup}/`)) {
    return null;
  }

  return (
    <>
      <LifecycleSection status={jsonData.status} />
      <EvictionSummary evictions={jsonData.status?.schedulingStats?.evictions} />
    </>
  );
}
