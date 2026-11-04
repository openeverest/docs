# Prerequisites

## Kubernetes

OpenEverest runs on any CNCF-conformant Kubernetes cluster, managed or self-hosted:

- **Kubernetes 1.32 or later.** The Helm chart refuses to install on older versions.
- **A default StorageClass** that can provision persistent volumes. Instances store their data on persistent volumes, and the creation form offers the StorageClasses available in the cluster.
- **Enough nodes for your topologies.** Providers spread the data-bearing members of an instance across nodes by default, so a three-member replica set needs three schedulable nodes. You can change this per instance with [pod scheduling](../administer/pod_scheduling.md) rules.
- **Enough capacity for your instances.** The OpenEverest core is small (the server requests 100m CPU and 20Mi of memory, the controller 10m CPU and 64Mi). Most of the capacity goes to the instances you create and the Operators that providers install. A local cluster with 8 GB of memory is enough for the core and one or two small instances.

OpenEverest does not create Kubernetes clusters. If you need one, see [Create an EKS cluster](eks.md) or [Create a GKE cluster](gke.md). For local testing, [k3d](https://k3d.io/) and [kind](https://kind.sigs.k8s.io/) work well.

## Tools

On the machine you install from, you need:

- [`kubectl`](https://kubernetes.io/docs/tasks/tools/), configured to access the cluster. Check access with:

    ```sh
    kubectl get nodes
    ```

- [Helm](https://helm.sh/docs/intro/install/) 3. OpenEverest, its providers and its plugins are all installed as Helm charts.
- Optionally, [yq](https://github.com/mikefarah/yq), used in some commands in these docs to read the initial admin password.

:::note

The `everestctl` command-line tool does not install OpenEverest 2 yet. Use Helm.

:::

## Optional components

- **An Ingress controller or a load balancer** to expose the OpenEverest UI outside the cluster. See [Expose OpenEverest](install_everest_helm_charts.md#expose-openeverest).
- **[cert-manager](https://cert-manager.io/)** to issue TLS certificates for OpenEverest. See [TLS](../security/tls_setup.md).
- **S3-compatible object storage** for backups. See [Backup storage](../backups_and_restore/backup_storage.md).
- **An OpenID Connect identity provider** for single sign-on. See [Single sign-on](../security/sso_idp_integration.md).

## Next steps

<span className="oe-button">[Install OpenEverest →](install_everest_helm_charts.md)</span>
