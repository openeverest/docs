# Uninstall OpenEverest

OpenEverest, its providers and its plugins are Helm releases, so you remove them with `helm uninstall`.

:::warning

Uninstalling OpenEverest removes all instances and their data from the Kubernetes cluster. Back up anything you want to keep first. Backups already written to S3-compatible storage stay in the bucket unless you delete them.

:::

## Before you begin

Delete your instances from the OpenEverest UI first. This lets the providers clean up the underlying resources while they are still running. Removing the Helm releases or namespaces first can leave orphaned resources behind.

## Uninstall OpenEverest

To uninstall OpenEverest, follow these steps:

1. List the Helm releases in the `everest-system` namespace to identify the OpenEverest core release and any installed providers:

    ```sh
    helm list -n everest-system
    ```

    <details>
    <summary>Expected output</summary>

    ```sh
    NAME                              NAMESPACE       REVISION  STATUS    CHART
    everest-core                      everest-system  1         deployed  openeverest-2.0.0-dev.4
    provider-percona-server-mongodb   everest-system  1         deployed  provider-percona-server-mongodb-0.5.0
    ```

    </details>

2. Uninstall each provider, monitoring extension and plugin release. Repeat this command for every release listed in the previous step except the core:

    ```sh
    helm uninstall provider-percona-server-mongodb -n everest-system
    ```

3. Uninstall the OpenEverest core release:

    ```sh
    helm uninstall everest-core -n everest-system
    ```

4. Delete the `everest-system` namespace:

    ```sh
    kubectl delete ns everest-system
    ```

5. Remove the OpenEverest [Custom Resource Definitions (CRDs)](https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/).

    :::warning[warning]

    Helm does not delete CRDs when you uninstall a release, so this step is required for a complete removal. Deleting a CRD also deletes every custom resource of that type across the cluster. Make sure the CRDs are not used by anything outside OpenEverest before you delete them.

    :::

## Remove CRDs

All OpenEverest CRDs belong to API groups that end in `openeverest.io`. List them:

```sh
kubectl get crd -o name | grep 'openeverest\.io$'
```

Then delete them:

```sh
kubectl get crd -o name | grep 'openeverest\.io$' | xargs kubectl delete
```

:::warning[Provider CRDs]

Each provider brings the CRDs of the Operator it drives (for example, the Percona Server for MongoDB CRDs). These are cluster-scoped and are **not** removed when you uninstall the provider chart. Remove them only if no other workloads in the cluster depend on them. Inspect the remaining CRDs with:

```sh
kubectl get crd
```

:::
