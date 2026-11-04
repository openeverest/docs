# Instance presets

:::info[Availability]

Instance presets are available in OpenEverest 2.0.0 Developer Preview 3 and later. In the current release, users can deploy from a preset in one click. Editing a preset before deploying, and managing presets from the UI, arrive in a later release.

:::

## Introduction

An **instance preset** is a reusable, ready-to-deploy configuration for an OpenEverest Instance. It captures a complete instance shape — provider, version, topology, component sizing, storage and scheduling — as a single Kubernetes object that users pick from a list instead of filling in every field by hand.

Presets turn instance creation into naming the instance and pressing **Create**.

## Why presets matter

Deploying an Instance from scratch means configuring each component individually: replicas, resources, storage class, backup, scheduling and more. This is repetitive, error-prone, and hard to keep consistent across a team.

Presets solve this by providing:

1. **One-click deployment.** A curated configuration that is production-ready out of the box, so users do not have to know every field to deploy a sound instance.
2. **Consistency.** Everyone deploying from the same preset gets the same shape, which removes drift between environments and between team members.
3. **A safe default surface.** Administrators and provider authors encode good defaults once; users select rather than assemble. Power users still get the full parameter surface when they need it.

## Two kinds of presets

| Kind | Scope | Can reference namespaced objects | Typical author |
| --- | --- | --- | --- |
| `ClusterInstancePreset` | Cluster | No | Providers and platform administrators |
| `InstancePreset` | Namespace | Yes, in its own namespace | Teams that own a namespace |

- A **`ClusterInstancePreset`** can create instances in any namespace. Because it does not know the target namespace, it must not reference namespaced objects such as Secrets. Leave those references empty — see [Namespaced references](#namespaced-references). Cluster-scoped values, such as a StorageClass, can be set directly.
- An **`InstancePreset`** lives in a namespace and can only create instances there. It may reference Secrets and other objects in that namespace by name, so it can capture a complete, known-good configuration.

The `spec` of both kinds has the same structure as `Instance.spec`, so a preset can be applied to create an instance verbatim.

## How presets reach a cluster

1. **Shipped with a provider.** A provider's Helm chart can bundle `ClusterInstancePreset`s, so installing the provider also installs ready-made configurations for it. This is the common path.
2. **Authored directly.** An administrator or a team creates a preset with `kubectl` to capture an organization-specific configuration.

List the presets:

```sh
kubectl get clusterinstancepresets
kubectl get instancepresets -A
```

### Creating a preset as a CR

Apply an `InstancePreset` like any other Kubernetes resource:

```yaml
apiVersion: core.openeverest.io/v1alpha1
kind: ClusterInstancePreset
metadata:
  name: mongodb-production
spec:
  providerRef:
    name: percona-server-mongodb
  version: "8.0.12"
  topology:
    type: replicaSet
  components:
    engine:
      type: mongod
      replicas: 3
      resources:
        limits:
          cpu: "2"
          memory: 8Gi
      storage:
        size: 100Gi
        storageClass: fast-ssd   # cluster-scoped — safe to set in a preset
```

```bash
kubectl apply -f mongodb-production-preset.yaml
```

The preset is now available in every namespace and appears in the creation wizard for the `percona-server-mongodb` provider.

### Shipping presets with a provider

Provider authors bundle presets in the provider's Helm chart. Presets are declared in the chart's `values.yaml` under the `presets:` key, and each entry is rendered into a `ClusterInstancePreset` resource when the chart is installed.

```yaml
# charts/<provider-name>/values.yaml
presets:
  - name: standalone
    enabled: true
    spec:
      providerRef:
        name: my-provider
      version: "8.0.12"
      topology:
        type: standalone
      components:
        engine:
          replicas: 1
          resources:
            limits:
              cpu: "1"
              memory: 2Gi
          storage:
            size: 25Gi
```

Each entry has three fields:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Preset name prefix, combined with the provider `shortName` to form the resource name |
| `enabled` | bool | Set to `false` to exclude the preset from the rendered chart |
| `spec` | object | The full `InstancePresetSpec` (provider, version, topology, components, …) |

The rendered resource is named `<shortName>-<preset.name>` (for example, `psmdb-standalone`). Installing the provider chart installs the presets alongside it; disabling an entry removes it on the next chart upgrade.

:::info[For provider authors]

See the [Provider Development Guide](https://github.com/openeverest/provider-sdk/blob/main/PROVIDER_DEVELOPMENT.md) for the full workflow of defining, rendering and testing presets shipped with a provider.

:::

### Namespaced references

A `ClusterInstancePreset` can't know the namespace an instance will be created in, so it must not name namespaced objects such as Secrets or monitoring destinations. If instances need them, either:

- use an `InstancePreset` in the target namespace, which can name them directly; or
- leave them out of the `ClusterInstancePreset` and add them to the instance after it is created.

Automatic resolution of namespaced defaults for cluster-wide presets is planned.

## Using presets in the UI

:::warning[UI is pick-and-use only]

From the UI, users can only select an existing preset and create an instance from it. Presets cannot be created, edited or deleted through the UI yet — they are authored as CRs or shipped with providers (see [How presets reach a cluster](#how-presets-reach-a-cluster)).

:::

In the instance creation wizard, presets are the starting point:

1. Open the creation wizard and choose a provider. The wizard shows a **preset picker** filtered to that provider.
2. Select a preset. OpenEverest fills the form with the preset's configuration. The topology is locked and the deeper configuration steps are disabled, since the preset already defines them.
3. Name the instance and press **Create**. The resolved configuration is submitted as-is, with an annotation recording which preset it came from: `openeverest.io/instance-preset` for an `InstancePreset`, `openeverest.io/cluster-instance-preset` for a `ClusterInstancePreset`.

The following demo shows the full flow of creating an instance from a preset:

<video controls width="100%" style={{maxWidth: "900px"}}>
  <source src="../images/presets-demo.mp4" type="video/mp4" />
  Your browser does not support the video tag. You can
  <a href="../images/presets-demo.mp4">download the video</a> instead.
</video>

## Restrict users to presets

With [RBAC](rbac.md), you can let users create instances only from presets: grant them `create` on `instances` but not `deploy`. They can then deploy any preset they can read, but not change its settings.

## Limitations

Presets in this release have the following limitations:

- Presets cannot be created from the UI. Users can only pick an existing preset and deploy from it; presets are authored as CRs or shipped with providers.
- Presets can be applied but not edited before deploying from the UI — the resolved configuration is submitted verbatim.
- Presets are scoped to a single provider and cannot be shared across providers.
- Creating an instance from scratch, without a preset, is unchanged and remains fully available.
