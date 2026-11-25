# Extension compatibility

OpenEverest and its extensions — [providers](providers.md), [monitoring extensions](monitoring-extensions.md) and [plugins](generic-plugins.md) — are released separately. This page explains which extension releases work with which OpenEverest, how to find the release that works with yours, and what happens when they don't match.

## How compatibility works

Every extension release is built for one OpenEverest release and records which one: its **stamp**. The tooling that builds the extension writes it, so it always matches the code. The chart carries it as the `openeverest.io/contract-version` annotation, in its `Chart.yaml` and on the objects OpenEverest reads, such as the `Provider`.

Every OpenEverest release accepts extensions built for a range of OpenEverest releases: its **compatibility window**. The window starts at the oldest release it still supports, and ends at the release that last changed what extensions rely on — usually the release itself, or, for a patch release, the release it patches. An extension works when its stamp is inside the window. Patch releases don't change what extensions rely on, so an extension that works with 2.1.0 also works with 2.1.1. What extensions rely on — the CRDs, the API and the conventions OpenEverest and its extensions share — is called the contract, hence the `contract-version` in the names of the annotations below.

For example, on an OpenEverest whose window is 2.0.0 to 2.1.0:

| Extension built for | Result |
|---|---|
| `2.0.0` or `2.1.0` | Works. |
| `2.2.0` | Needs a newer OpenEverest. Upgrade OpenEverest, or install an older release of the extension. |
| `2.0.0-beta.1` | Built for an older OpenEverest. Upgrade the extension. |
| No stamp | Compatibility not declared: OpenEverest can't check it. Extension releases published before stamps existed have none. |

Nobody maintains lists of supported versions: the stamp is a fact about the build, and the window is OpenEverest's own statement of what it accepts.

:::note[Unreleased builds]

A version ending in `.next`, such as `2.0.0-alpha.1.next`, or in `-alpha.0`, such as `2.1.0-alpha.0`, stands for an unreleased OpenEverest build from its `main` branch. You see one only when you run such a build. Extension releases are never built for one, and messages call it "an unreleased OpenEverest build".

:::

## Check the window of your OpenEverest

OpenEverest publishes its window as annotations on each of its custom resource definitions (CRDs). To read it:

```sh
kubectl get crd providers.core.openeverest.io -o jsonpath='OpenEverest {.metadata.labels.openeverest\.io/version}{"\n"}Accepts extensions built for {.metadata.annotations.openeverest\.io/min-contract-version} to {.metadata.annotations.openeverest\.io/contract-version}{"\n"}'
```

```text
OpenEverest 2.1.1
Accepts extensions built for 2.0.0 to 2.1.0
```

| Key on every OpenEverest CRD | Meaning |
|---|---|
| `openeverest.io/version` label | The OpenEverest release that is installed. |
| `openeverest.io/min-contract-version` annotation | The bottom of the window: the oldest OpenEverest an extension can be built for. |
| `openeverest.io/contract-version` annotation | The top of the window: the newest OpenEverest an extension can be built for. |
| `openeverest.io/upgradable-from` annotation | The OpenEverest releases that can be upgraded to this one in place. It is empty when this release must be installed fresh. |

While OpenEverest is being upgraded, its CRDs can briefly disagree. Read the window again once the upgrade has finished.

To see which OpenEverest the installed providers were built for:

```sh
kubectl get providers -o custom-columns='NAME:.metadata.name,BUILT-FOR:.metadata.annotations.openeverest\.io/contract-version,RUNNING:.status.contractVersion,ACKNOWLEDGED:.metadata.annotations.openeverest\.io/compatibility-acknowledged'
```

`BUILT-FOR` is the stamp of the installed chart, `RUNNING` the stamp of the provider build that last started, and `ACKNOWLEDGED` an [acknowledgement](#acknowledge-an-incompatibility), if any.

To read the window of an OpenEverest release before you install or upgrade to it:

```sh
helm show crds openeverest/openeverest --version <version> \
  | grep -m2 -E 'openeverest\.io/(min-)?contract-version'
```

## Find the release that works

### In the Plugin Hub

The [Plugin Hub](hub.md) reads the window from the cluster and compares it with the stamp of every release in the Hub catalog. For each extension it:

- offers the newest release that works with your OpenEverest, which may be older than the newest release;
- marks the releases that don't, with the OpenEverest they need (**Needs OpenEverest 2.2.0**) or as **Built for an older OpenEverest**, and says when no release works yet (**No release supports OpenEverest 2.1.1 yet**);
- marks releases without a stamp **Compatibility not declared**, and installs them with a notice.

Before it installs or upgrades an extension, the Plugin Hub checks the stamp in the chart itself. It refuses a release that doesn't work with your OpenEverest, unless you confirm that you want to install it anyway, which [acknowledges the incompatibility](#acknowledge-an-incompatibility).

### In the Hub catalog

The [Hub catalog](https://github.com/openeverest/hub) lists every release of every extension with its stamp, as `contractVersion` in its index. To list them for one extension, for example the PostgreSQL provider:

```sh
curl -s https://raw.githubusercontent.com/openeverest/hub/main/index/index.json \
  | jq -r '.extensions[] | select(.name == "percona-postgresql")
      | .artifacts.chart.channels[.artifacts.chart.defaultChannel].releases[]
      | "\(.version)\t\(.contractVersion // "not declared")"'
```

The name is that of the extension's directory in the catalog, such as [`extensions/providers/percona-postgresql`](https://github.com/openeverest/hub/tree/main/extensions/providers/percona-postgresql).

### For one release

The stamp is in the chart's `Chart.yaml`:

```sh
helm show chart oci://ghcr.io/openeverest/charts/provider-percona-postgresql \
  --version <version> | grep openeverest.io/contract-version
```

## When they don't match

The Plugin Hub checks every extension it installs, as described above. When you apply an extension yourself, what happens depends on the tool.

### Helm and Flux

Provider charts check the window when Helm renders them, before anything is applied. An install or upgrade of a release outside the window fails, and the message names the OpenEverest it needs and how to install it anyway:

```text
Error: INSTALLATION FAILED: execution error at (provider-percona-postgresql/templates/openeverest-compat-check.yaml:8:4): provider-percona-postgresql 0.9.0 needs OpenEverest 2.2.0 or later; this cluster runs OpenEverest 2.1.1. To install it anyway on this OpenEverest, set compatibility.acknowledge.coreVersion=2.1.1.
```

- Nothing is applied and no failed release is left behind. Once you have upgraded OpenEverest, run the same command again.
- Flux renders charts with Helm against the cluster, so the check runs there too: the `HelmRelease` reports the same message and nothing is applied.
- Changing the values of an installed release is never blocked, as long as its chart, and so its stamp, stays the same.
- The check reads the window as the identity that runs Helm. OpenEverest lets every authenticated identity read its CRDs, so no extra permissions are needed.

### Argo CD and plain manifests

Argo CD renders charts without access to the cluster, so the check above can't run there. The same is true of manifests rendered with `helm template` and applied with `kubectl`. Providers check again when they start, however they were applied:

- A new provider build that the installed OpenEverest doesn't accept waits. Its pod keeps running but never becomes ready, and the provider records a warning event on its `Provider`, such as `a new build (for OpenEverest 2.2.0) is waiting until OpenEverest 2.2.0 is installed`. When the provider is being upgraded, the pods of the previous build keep running and keep managing your instances.
- It starts by itself as soon as OpenEverest is upgraded to a release that accepts it. Alternatively, roll the provider back to the release that ran before.
- Only new builds are checked. A provider that already runs is never stopped by a pod restart, a node drain or an OpenEverest rollback.

To see why a provider is waiting, use its name from `kubectl get providers`:

```sh
kubectl describe provider <name>
```

Provider charts set no Argo CD annotations themselves. To add some, such as a sync wave, to the objects OpenEverest reads — the `Provider`, its backup classes and its presets — set the chart value `openeverest.annotations`. For example, to have Argo CD apply them before the provider's `Deployment`:

```yaml
openeverest:
  annotations:
    argocd.argoproj.io/sync-wave: "-1"
```

Keys under `openeverest.io/` belong to the chart and to OpenEverest, and the chart refuses them.

## Acknowledge an incompatibility

To run an extension release outside the window anyway, for example to try a fix before a compatible release exists, acknowledge the incompatibility: set `compatibility.acknowledge.coreVersion` to the OpenEverest release installed in the cluster. The error message names it, and so does the `openeverest.io/version` label of the CRDs.

```sh
helm upgrade --install provider-percona-postgresql \
  oci://ghcr.io/openeverest/charts/provider-percona-postgresql \
  --namespace everest-system \
  --version <version> \
  --set compatibility.acknowledge.coreVersion=<openeverest-version>
```

- The chart writes the acknowledgement on its objects, as the `openeverest.io/compatibility-acknowledged` annotation, so both the check at install and the provider's check at startup accept it, whichever tool applies the chart. With Argo CD or Flux, set it in the values of the Application or `HelmRelease`.
- Installing a release that doesn't work with your OpenEverest from the Plugin Hub sets it for you, after you confirm.
- It holds on the release it names, and on the later releases that keep the same top of the window, typically patch releases.
- It expires with the first OpenEverest upgrade that moves the top of the window. From then on, the extension is checked again: upgrade it to a release that works, or acknowledge again on the new release.
- An acknowledgement that names a release you haven't installed yet, for example one committed to Git ahead of an upgrade, does nothing until that release is installed. You can only acknowledge an OpenEverest you run.

:::warning[An acknowledged extension is unsupported]

An acknowledged extension runs on an OpenEverest it was not built and tested for. One built for a newer OpenEverest can rely on fields and behavior the installed OpenEverest doesn't have; one built for an older OpenEverest can rely on behavior that has since changed or been removed. Instances can fail to reconcile, forms can show or save settings incorrectly, and backups or restores can fail. Acknowledge only when you accept that risk, back up your instances first, and upgrade to a compatible release as soon as one exists.

:::

## Upgrade order

Upgrade OpenEverest first, then the extensions:

1. Before you upgrade, check that every installed extension has a release that works with the target OpenEverest: read the window of the target release with `helm show crds`, as shown in [Check the window of your OpenEverest](#check-the-window-of-your-openeverest), and compare it with the stamps of the extension's releases in the [Hub catalog](#in-the-hub-catalog). If an extension has none yet, wait with the upgrade.
2. Upgrade OpenEverest. See [Upgrade](../upgrade/upgrade_with_helm.md).
3. Upgrade each extension to the newest release that works with the new OpenEverest. The Plugin Hub offers it.

Why this order: an extension release built for the new OpenEverest doesn't work on the old one, so Helm refuses a provider chart built for it, and a provider build waits. Upgrading OpenEverest, on the other hand, doesn't stop the extensions that already run. If the new OpenEverest no longer accepts the release an extension was built for, that extension is unsupported until you upgrade it, and its acknowledgement, if it has one, expires when the upgrade moves the top of the window.
