# Knative

A Headlamp plugin for visualizing and managing Knative Services. Knative is a Kubernetes-based platform for deploying and managing serverless workloads. It provides automatic scaling, traffic management, and simplified deployment workflows for containerized applications.

This plugin adds a new item (Knative) to the sidebar and provides GUI functionality to list and view service details, edit traffic splitting, update concurrency settings, perform redeploy/restart operations.

## Knative Installation

Please refer to the [official installation guide](https://knative.dev/docs/install/) for Knative to learn to install it.

## Plugin Installation in Headlamp for Desktop

Go to the Plugin Catalog, search for the Knative plugin, and click the Install button. Reload the UI (Navigation menu > Reload, or use the notification after installing the plugin) to see the new Knative item in the sidebar.

## Demo

<div align="center">
  <a href="https://www.youtube.com/watch?v=9HAcUsopSYE" target="_blank"><img src="https://img.youtube.com/vi/9HAcUsopSYE/0.jpg" style="width:100%;"></a>
  <br>Watch video demo <a href="https://www.youtube.com/watch?v=9HAcUsopSYE" target="_blank">https://www.youtube.com/watch?v=9HAcUsopSYE</a>
</div>

## Development

To make contributions and UI testing easier, this repository includes a suite of test manifests. You can apply these to your local development cluster to instantly generate a robust set of Knative resources covering various states and edge cases (like traffic splits, rollbacks, scaled-to-zero services, and broken domain mappings).

To deploy the test suite:
```bash
kubectl apply -f test-files/deploy/
```

### Test Suite Manifests

* **`00-namespace.yaml`**: Creates the `knative-map-test` namespace to isolate the test suite resources.
* **`01-service-healthy.yaml`**: Deploys a baseline, fully healthy Knative Service with 100% traffic routed to a single revision.
* **`01-service-failed-revision.yaml`**: Deploys a Knative Service containing a revision designed to fail (invalid container command) to verify the map's error rendering (`Ready: False`).
* **`01-service-traffic-split-v1.yaml`**: Step 1 for the traffic split scenario, deploying the initial `v1` revision.
* **`02-service-traffic-split-v2.yaml`**: Step 2 for the traffic split scenario, deploying `v2` and configuring a 50/50 traffic split across targets to test edge percentages on the map.
* **`01-service-scaled-to-zero.yaml`**: Deploys a Knative Service explicitly locked to `min-scale: 0` and `max-scale: 0` to verify idle/inactive rendering.
* **`01-service-metrics-demo.yaml`**: Deploys a Knative Service running `go-httpbin` specifically designed to test error rates and metric visualization.
* **`01-service-rollback-v1.yaml`**: Step 1 for the rollback scenario, deploying the initial `v1` revision.
* **`02-service-rollback-v2.yaml`**: Step 2 for the rollback scenario, deploying `v2` but pinning 100% traffic to `v1` (`stable`) and 0% to `v2` (`canary`) to test tag visualization.
* **`03-domainmapping-healthy.yaml`**: Creates a healthy `DomainMapping` and its requisite `ClusterDomainClaim` to test active mapping edges on the graph.
* **`03-domainmapping-broken-ref.yaml`**: Creates a `DomainMapping` targeting a non-existent Knative Service to verify the map handles broken references gracefully.
* **`03-domainmapping-core-svc.yaml`**: Creates a `DomainMapping` targeting a core Kubernetes `v1 Service` to ensure the map ignores non-Knative targets.

### Traffic Shell Scripts

To test the Knative metrics charts (integrated via the Prometheus plugin), a suite of traffic generation scripts is included in `test-files/traffic/`. These scripts deploy ephemeral pods inside the cluster that send HTTP requests to the `metrics-demo-service`, generating realistic data for all chart views.

Before running any traffic script, ensure you have:
1. Deployed the test namespace and metrics demo service (`kubectl apply -f test-files/deploy/00-namespace.yaml && kubectl apply -f test-files/deploy/01-service-metrics-demo.yaml`)
2. Applied the PodMonitor so Prometheus scrapes the queue-proxy metrics (`kubectl apply -f test-files/podmonitor.yaml`)

**Individual Scripts**:
* **`generate-traffic.sh`**: The original mixed traffic generator. Runs 3 phases: 100% success, 5% errors (split between 400 and 500 codes), and 40% errors. Tests the **Request Rate** chart's ability to show `2xx`/`4xx`/`5xx` response code class breakdown.
* **`generate-error-traffic.sh`**: Targets specific HTTP status codes (200, 400, 403, 404, 500, 502, 503) in phased patterns. Useful for validating that the **Request Rate** chart correctly buckets various codes into their response code classes.
* **`generate-latency-traffic.sh`**: Sends requests with controlled delays (0.1s, 0.5s, 2s) using go-httpbin's `/delay` endpoint. Tests the **Latency** chart's P50/P95/P99 histogram visualization.
* **`generate-resource-stress.sh`**: Creates CPU and memory pressure via large response bodies (`/bytes/102400`) and high concurrency. Tests the **Resources** chart's CPU and Memory panels.
* **`generate-sustained-traffic.sh`**: Runs continuous mixed traffic for a configurable duration (default 5 minutes). Produces a realistic traffic mix (70% success, 10% slow, 10% client errors, 10% server errors) suitable for testing all charts over a longer window. Usage: `./test-files/traffic/generate-sustained-traffic.sh [namespace] [service-name] [duration-seconds]`

#### Running All Scripts

The master script sets up two revisions with a 70/30 traffic split, then runs all traffic generators sequentially:

```bash
./test-files/traffic/run-all-traffic.sh
```

You can also pass a custom namespace and service name:

```bash
./test-files/traffic/run-all-traffic.sh knative-map-test metrics-demo-service
```

### Prometheus Metrics Integration

The Prometheus plugin provides the following metric charts on KService and Revision detail pages when Prometheus is installed and the PodMonitor is active:

| Chart | KService | Revision | What it shows |
|---|---|---|---|
| **Request Rate** | ✅ | ✅ | HTTP requests/sec grouped by response code class (`2xx`, `4xx`, `5xx`) |
| **By Revision** | ✅ | — | Total request rate broken down by individual revision (shows traffic split distribution) |
| **Latency** | ✅ | ✅ | P50, P95, P99 request latency from `revision_request_latencies_bucket` histogram |
| **Resources** | ✅ | ✅ | CPU usage (cores) and Memory usage (bytes) for pods matching the service/revision |

The `podmonitor.yaml` file configures Prometheus to scrape the Knative `queue-proxy` sidecar (port 9091) on all pods with the `serving.knative.dev/revision` label.

## Knative Eventing

The plugin covers the core Eventing resources alongside Serving. Eventing installs
from its own release YAML and does not require Serving, so the Eventing sidebar
entries appear based on the `brokers.eventing.knative.dev` CRD rather than the
Serving one.

| View | What it shows | Who it is for |
|---|---|---|
| **Brokers** | Class, ingress URL, dead letter sink, ready state | Operators checking whether the event mesh endpoint is up and where failures land |
| **Triggers** | Broker, filter summary, resolved subscriber, ready state | Anyone debugging "my events stopped arriving" |

Both views are read-only. Brokers and Triggers route to Headlamp's built-in
Custom Resource detail pages, and the Trigger page gains an **Event Routing**
section that resolves the three things a raw YAML view makes you work out by
hand: which Broker, which events, which subscriber.

### Trigger filtering

A Trigger can filter two ways, and the plugin surfaces which one is in effect:

- `spec.filters`, the CloudEvents Subscriptions API dialect (`all`, `any`, `not`,
  `exact`, `prefix`, `suffix`, `cesql`). Rendered as an expression tree.
- `spec.filter.attributes`, the older exact-match map. Still supported, shown
  with a deprecation note.

When a Trigger sets both, the CRD documents that `filters` overrides `filter`.
The detail view renders `filters` and warns that the legacy field is being
ignored, because a Trigger with a stale `spec.filter` reads as though it filters
on those attributes and does not.

### Eventing Test Manifests

#### Prerequisites

The Eventing plugin views themselves need only Eventing installed. The test
manifests additionally need **Knative Serving**, because every subscriber and
dead-letter target they reference is a `serving.knative.dev/v1` Service
(`order-processor`, `always-fails`). Without Serving, those applies fail with
`no matches for kind "Service" in version "serving.knative.dev/v1"`, and any
Trigger that did apply reports "Subscriber unresolved" — not because the plugin
is wrong, but because the subscriber never existed.

**Install Serving before Eventing.** The `eventing-controller` resolves
subscriber references through API discovery that it caches at startup and does
not retry. If Eventing starts first, Triggers keep reporting

```
failed to get object .../order-processor: services.serving.knative.dev "order-processor" not found
```

even after Serving is installed and the Service is Ready. If you hit this, force
the controller to rediscover:

```bash
kubectl rollout restart deployment/eventing-controller -n knative-eventing
kubectl rollout status deployment/eventing-controller -n knative-eventing --timeout=90s
kubectl annotate trigger --all -n knative-eventing-test force-resync="$(date +%s)" --overwrite
```

#### Applying

```bash
kubectl apply -f test-files/eventing/
```

* **`20-broker-healthy.yaml`**: Namespace, an in-memory Broker, a subscriber Service, and two healthy Triggers using `exact` and `prefix` filters.
* **`21-trigger-edge-cases.yaml`**: The four states the UI has to tell apart. An unresolvable subscriber (warning state on the map, "Subscriber unresolved" chip in the list), a legacy `spec.filter`, a Trigger setting both filter fields, and a nested `any`-inside-`all` with a negation for the expression tree renderer.
* **`22-pingsource-traffic.yaml`**: A PingSource emitting into the Broker every minute so Triggers actually fire, plus a second Broker configured with a dead letter sink and a retry policy.

The map shows Brokers and Triggers as a separate **Knative Eventing** source
group, with an edge from each Broker to the Triggers that subscribe to it.
Cross-namespace `spec.brokerRef` references are labelled on the edge.

## Proof of Concept: Knative Eventing, deployed and debugged end to end

This section records what happened when the Eventing Broker and Trigger work was
deployed and operated against a live cluster, and the defects that surfaced only
there.

### What I validated

I worked from the Knative Eventing branch `knative-eventing-poc` — 26 files,
2,361 insertions, adding Broker and Trigger support to a plugin that until now
covered only Serving. The base commit is authored by Shivam; I took the branch on
as a reviewer and operator rather than as its author, and my own work on it is
four commits on top.

The branch adds three pure-logic modules that encode upstream Knative semantics
rather than re-deriving them: `buildFilterView` in `src/utils/triggerFilter.ts`,
which applies the CRD's own documented precedence ("In the event of users
specifying both Filter and Filters, then the latter will override the former");
`resolveBrokerRef` in `src/utils/brokerRef.ts`, which mirrors the precedence in
upstream's `pkg/broker/filter/filter_handler.go`; and `resolveSink` /
`describeSink` in `src/utils/sink.ts`. On top of those sit the Broker and Trigger
list views, a recursive `FilterExpression` renderer for `all` / `any` / `not` /
`cesql` trees, and a new Knative Eventing map group.

Running it surfaced the architectural constraint that shapes any future Trigger
work, and it is the mirror image of the constraint in Headlamp's Kueue plugin.
There, a Workload is reachable by two routes, so a feature must be a
details-view section rather than a page-level component or it goes silently
missing on one path. Here the opposite holds. The branch registered the event
routing summary through `registerDetailsViewSection` and gave Trigger no route of
its own, so its detail page was Headlamp's generic Custom Resource page. Headlamp
0.44 does not mount plugin detail sections on that page. The section was
registered correctly, built correctly, and never rendered: a Trigger's filtering,
subscriber and dead-letter sink were invisible in the UI, which is the entire
feature. Any per-Trigger work must own a route, backed by `DetailsGrid`, the way
KService and Revision already do in this same plugin.

A second constraint is documented in the branch and worth carrying forward:
`src/eventingMap.tsx` builds the Broker-to-Trigger edge by hand because
`registerResourceRelationProvider`, the natural home for an edge spanning two map
sources, exists on Headlamp `main` but is not exported by
`@kinvolk/headlamp-plugin` 0.14.0, the version this plugin pins. The cost is that
the Trigger map source must also list Brokers.

### Testing

33 test cases covering filter precedence and expression parsing
(`triggerFilter`), sink resolution and non-http(s) URI rejection (`sink`), and
broker-reference precedence (`brokerRef`), bringing the plugin's suite to 55
tests across 7 files, all passing.

![Test suite: 55 tests across 7 files, all passing](screenshot/01-tests.png)

The suite's limits matter as much as its coverage. Two of the defects below
survive a clean `tsc`, a green build and all 55 tests, because the imports exist
as types and the suite covers the pure helper modules without ever rendering a
list or a detail page against live objects.

### Live verification

The environment is a dedicated `kind` cluster created with `extraMounts`, binding
the plugin directory into the node so a rebuild is picked up by a browser
refresh. Knative Serving v1.23.0 with Kourier and Knative Eventing v1.23.0 are
installed and healthy. Headlamp v0.44.0 runs in-cluster, installed via Helm,
authenticated with a ServiceAccount token and reached over port-forward — the
deployment path administrators actually use, rather than the simpler
Docker-on-host route.

Applying the three `test-files/eventing` manifests produces, in one cluster at
one timestamp, every state the UI has to tell apart: two healthy Brokers, one
with a dead-letter sink and retry policy; Triggers with `exact`, `prefix`,
legacy-attribute and deeply nested `any`-inside-`all`-with-`not` filters; a
Trigger that sets both `spec.filters` and `spec.filter`; a Trigger pointing at a
Service that does not exist; and a Trigger routing to a permanently failing
subscriber through the dead-letter path. Five `Ready=True` and exactly two
intentionally `Ready=False`.

![Brokers and Triggers on the live cluster](screenshot/02-cluster-state.png)

Note `both-filters` in that output: `Ready=True`, blank reason, indistinguishable
from a correctly configured Trigger.

The state this feature exists to expose is exactly that Trigger. The API server
accepts a Trigger that sets `spec.filter` and `spec.filters` together and reports
no error; the data plane silently ignores the legacy field. Nothing in `kubectl
get trigger`, in the seven status conditions the object carries, or in the raw
YAML indicates which filter is live. In a conditions table that Trigger reads as
perfectly healthy.

The plugin surfaces the override as an explicit warning, and colours the row in
the list so an operator scanning a namespace sees it without opening anything.

![Triggers list with filter summaries and unresolved-subscriber chips](screenshot/03-triggers-list.png)

![Trigger detail: spec.filter is set and ignored](screenshot/04-both-filters.png)

![The same panel beside the raw object](screenshot/05-panel-vs-yaml.png)

The YAML carries `filter.attributes.type: this.value.is.ignored` alongside
`filters`, with nothing marking which one wins. The panel is the only place it is
stated. That is the difference between reading the object and understanding it.

The recursive renderer handles the nested case the list column can only summarise
as `all(3)`:

![Nested filter expression, three levels deep](screenshot/06-nested-filter.png)

### The five defects deploying surfaced

None is reachable by reading the code or running the tests.

**1. The Eventing test manifests require Serving, contradicting the README.** The
README stated that Eventing "installs from its own release YAML and does not
require Serving" — true of the plugin's sidebar-visibility logic, which is
precisely what this branch fixes by splitting `isKnativeInstalled` into
`isKnativeServingInstalled` and `isKnativeEventingInstalled` and OR-ing them, so
an Eventing-only cluster no longer hides the entire Knative sidebar. It is not
true of the demo manifests: every subscriber and dead-letter target across all
three files is a `serving.knative.dev/v1` Service. Without Serving those applies
fail outright and every Trigger reports "Subscriber unresolved" — not because
anything is broken, but because the subscriber never existed.

**2. Install order matters, because the Eventing controller caches API discovery
at startup.** With Serving installed after Eventing, Triggers kept reporting that
`order-processor` was not found despite the Service existing and being Ready;
`eventing-controller` had started before the `serving.knative.dev` API existed and
does not retry discovery. Restarting the controller and force-resyncing the
Triggers clears it. Install Serving before Eventing.

**3. Mounting the plugin's `dist` directory alone produces a plugin that loads but
never registers.** Headlamp reads `package.json` from each plugin directory to
register it, and `npm run build` emits only `main.js`. The result is a bundle
Headlamp serves and lists at `/plugins` but never mounts: no sidebar entry, no
routes, no detail sections, and nothing in the browser console to explain the
absence. This one cost the most time to find precisely because every server-side
check passes.

**4. Both Eventing list pages crashed on a live cluster.**
`getEventingDetailsLink` imported `formatClusterPathParam` and
`getSelectedClusters` from `@kinvolk/headlamp-plugin/lib/cluster`, which is not
among the externals the Headlamp plugin runtime provides. It resolves to
`undefined`, and reading either name off it throws. Every row of both lists
renders a details link, so neither page rendered at all. The plugin's own
`domainMapping.ts` and `clusterDomainClaim.ts` already carry private local copies
of these two helpers for exactly this reason; the Eventing code imported them
instead. Fixed by following the established pattern.

**5. The event routing summary rendered nowhere**, for the architectural reason
above. Fixed by giving Trigger a plugin-owned detail route backed by
`DetailsGrid`. Two smaller constraints fell out of that fix, both learned from
the Serving side of the plugin: the detail route must be registered *before* the
list route, or `/knative/triggers` matches `/knative/triggers/:namespace/:name`
first and the list re-renders in place of the detail page; and the list must link
to it with a `Link` carrying `routeName`, `params` and `activeCluster`, because
`activeCluster` supplies the `/c/<cluster>` path segment and a URL built without
it does not resolve.

The first two are environment and documentation gotchas rather than code defects,
but they make the difference between a demo that works first time and one that
appears completely broken. The last three are defects in the plugin, and the last
two make the Eventing feature unusable.

Code fixes are in commits `cab83d2f`, `d07563c6` and `2ca33eff`.

None of this was reachable by reading the code. The existing suite tests pure
functions well and never renders a component against a live object, so the two
defects that made this feature unusable were invisible to a green build, a clean
type check and 55 passing tests.
