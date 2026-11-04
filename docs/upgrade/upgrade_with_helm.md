# Upgrade OpenEverest

The OpenEverest core and each provider are separate Helm releases with their own versions. You upgrade them separately: first the core, then the providers.

:::warning[Developer Preview]

Upgrades between OpenEverest 2 Developer Preview releases are **not supported**. The `Instance` and `Provider` APIs change between previews without a migration path, so install each preview on a fresh cluster. Upgrading from OpenEverest 1.x to 2 is not supported either; a migration path is planned for the General Availability release.

The procedure below describes how upgrades work, for patch releases and for future releases.

:::

## Before you upgrade

- Read the [release notes](../release-notes/release_notes_index.md) of the target version, especially the breaking changes.
- Check which providers support the target version. The Plugin Hub and the provider release notes show the compatible core versions.
- Back up your instances. See [Create backups](../backups_and_restore/create_backups.md).
- Check your current releases:

    ```sh
    helm list -n everest-system
    ```

## 1. Upgrade the custom resource definitions

Helm does not upgrade CRDs during `helm upgrade`, and the OpenEverest chart refuses to upgrade until the CRDs match the target version. Upgrade them first with the `everest-crds` chart:

```sh
helm repo update
helm upgrade --install everest-crds openeverest/everest-crds \
  --namespace everest-system \
  --version <version> \
  --take-ownership
```

`--take-ownership` requires Helm 3.17 or later. It lets the `everest-crds` release adopt CRDs that were installed by the `openeverest` chart.

## 2. Upgrade the core

```sh
helm upgrade everest-core openeverest/openeverest \
  --namespace everest-system \
  --version <version> \
  --reuse-values
```

:::tip

Without `--reuse-values`, Helm resets every value you don't pass on the command line to the chart default. Either use `--reuse-values` or pass your complete values file with `-f`.

:::

The chart runs pre-upgrade checks. To skip them, set `upgrade.preflightChecks=false` and `upgrade.crdChecks=false` — only do this if you know why a check fails.

## 3. Upgrade the providers

Upgrade each provider to a version that supports the new core:

```sh
helm upgrade provider-percona-postgresql \
  oci://ghcr.io/openeverest/charts/provider-percona-postgresql \
  --namespace everest-system \
  --version <provider-version> \
  --reuse-values
```

A provider upgrade can change the components of running instances, for example new default images. Changes that would restart or disrupt an instance are applied according to the instance's maintenance settings.

## 4. Check the result

```sh
kubectl get pods -n everest-system
kubectl get providers
kubectl get instances -A
```

Log in to the UI and check that your instances are **Ready**.
