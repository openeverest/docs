# Add providers

A provider adds one technology to OpenEverest. You can install as many providers as you need, and add or remove them at any time. Each provider is a Helm chart that installs:

- the **provider controller**, which turns OpenEverest `Instance` resources into running workloads;
- in most cases, the **Kubernetes Operator** that the provider drives;
- a cluster-wide **`Provider`** resource that describes the technology's versions, topologies and forms;
- the provider's **backup classes** and, optionally, **instance presets**.

## Find a provider

The **Plugin Hub** in the OpenEverest UI lists all published providers and plugins, with their maturity, the OpenEverest versions they support, whether they are installed, and the exact `helm install` command for each. Open it from the **Plugin Hub** entry in the left menu. The same catalog is available on [GitHub](https://github.com/openeverest/hub).

What each provider supports — topologies, backups, point-in-time recovery, monitoring, exposure options — differs. The provider's page in the Plugin Hub and its README describe its capabilities and configuration.

See [Plugin Hub](../extend/hub.md).

## Install a provider

Install providers into the same namespace as the OpenEverest core, `everest-system`. For example, to add PostgreSQL:

```sh
helm install provider-percona-postgresql \
  oci://ghcr.io/openeverest/charts/provider-percona-postgresql \
  --namespace everest-system
```

Then check that the provider has registered:

```sh
kubectl get providers
```

The provider appears in the UI immediately: on the **Instances** page, in the **Create** menu, and as **Installed** in the Plugin Hub.

:::warning[Match the provider and core versions]

During the Developer Preview, the `Instance` and `Provider` APIs still change between releases, and a provider built for a newer OpenEverest may not start on an older one. Helm installs the newest provider release. If it doesn't start — for example with an error about a missing kind — install a provider release built for your OpenEverest version with `--version`. The OpenEverest release notes and each provider's release notes name the versions that go together.

:::

## Configure a provider

Providers accept Helm values like any chart. Common reasons to set them are to change the Operator's resources, to install extra presets, or to point at a private registry. See the provider's README for its values, or run:

```sh
helm show values oci://ghcr.io/openeverest/charts/provider-percona-postgresql
```

## Upgrade a provider

Providers are upgraded independently of the core:

```sh
helm upgrade provider-percona-postgresql \
  oci://ghcr.io/openeverest/charts/provider-percona-postgresql \
  --namespace everest-system \
  --version <version>
```

See [Upgrade](../upgrade/upgrade_with_helm.md).

## Remove a provider

Delete all instances of the technology first. Then uninstall the chart:

```sh
helm uninstall provider-percona-postgresql --namespace everest-system
```

:::warning

Instances that still reference a removed provider are no longer reconciled. Their pods keep running, but you can't change, back up or delete them from OpenEverest until you reinstall the provider.

:::

## Build your own

If the technology you need is not in the catalog, you can build a provider with the Provider SDK. See [Providers](../extend/providers.md#build-your-own-provider).
