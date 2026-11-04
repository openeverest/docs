import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Prerequisites

OpenEverest runs on any CNCF-conformant Kubernetes cluster — on your laptop, in any cloud or on-premises. It does not create the cluster for you.

## What the cluster needs

- **Kubernetes 1.32 or later.** The Helm chart refuses to install on older versions.
- **A default StorageClass** that provisions persistent volumes. To grow instance storage later, the StorageClass must allow volume expansion (`allowVolumeExpansion: true`).
- **Enough nodes for your topologies.** Providers place the data-bearing members of an instance on different nodes by default, so a three-member replica set needs three schedulable nodes. See [Pod scheduling](../administer/pod_scheduling.md) to change this.
- **Enough capacity for your instances.** The OpenEverest core is small: the server requests 100m CPU and 20Mi of memory, the controller 10m CPU and 64Mi. Most of the capacity goes to the Operators that providers install and to the instances you create, so size the cluster for your workloads.

## Get a cluster

<Tabs>
<TabItem value="local" label="Local (k3d)">

[k3d](https://k3d.io/) runs a lightweight Kubernetes cluster ([k3s](https://k3s.io/)) in Docker. It is the quickest way to try OpenEverest and the setup the OpenEverest developers use.

You need Docker with at least 8 GB of memory available — enough for OpenEverest, one provider and a small instance — and [k3d 5 or later](https://k3d.io/#installation).

Create a cluster with three nodes, so that instances with three members can spread across them:

```sh
k3d cluster create openeverest \
  --agents 2 \
  --image rancher/k3s:v1.37.1-k3s1
```

`--image` pins a Kubernetes version that OpenEverest supports; older k3d releases default to an older version. k3d switches `kubectl` to the new cluster. Check it:

```sh
kubectl get nodes
```

```text
NAME                       STATUS   ROLES           AGE   VERSION
k3d-openeverest-agent-0    Ready    <none>          10s   v1.37.1+k3s1
k3d-openeverest-agent-1    Ready    <none>          9s    v1.37.1+k3s1
k3d-openeverest-server-0   Ready    control-plane   13s   v1.37.1+k3s1
```

The cluster comes with the `local-path` StorageClass, which stores data on the nodes' disks and does not support volume expansion. That is fine for trying OpenEverest, not for production.

To delete the cluster and everything in it:

```sh
k3d cluster delete openeverest
```

Other local tools, such as [kind](https://kind.sigs.k8s.io/) or [minikube](https://minikube.sigs.k8s.io/), work too.

</TabItem>
<TabItem value="managed" label="Managed Kubernetes">

Any managed Kubernetes service works. Create a cluster with your provider's tools or console, and check that it has:

- Kubernetes 1.32 or later.
- At least three worker nodes, ideally spread across availability zones, sized for your instances. For a first test, three nodes with 2 vCPUs and 8 GB of memory each are a good start.
- A default StorageClass backed by the provider's block storage, with volume expansion enabled. Some services need a CSI driver add-on before volumes can be provisioned.
- Optionally, support for `LoadBalancer` services, to expose OpenEverest and instances outside the cluster.

Then configure `kubectl` to access the cluster, following your provider's documentation.

</TabItem>
<TabItem value="on-premises" label="On-premises">

On a self-managed cluster, make sure that:

- a CSI driver provides a default StorageClass. Local volumes work, but an instance's data then stays on the node that holds it; network or replicated storage lets pods move between nodes;
- the cluster has at least three schedulable worker nodes for highly available topologies;
- a load balancer implementation, such as [MetalLB](https://metallb.io/), or an Ingress controller is available if you want to expose OpenEverest outside the cluster.

</TabItem>
</Tabs>

## Tools

On the machine you install from, you need:

- [`kubectl`](https://kubernetes.io/docs/tasks/tools/), configured to access the cluster:

    ```sh
    kubectl get nodes
    ```

- [Helm](https://helm.sh/docs/intro/install/) 3. OpenEverest, its providers and its plugins are installed as Helm charts.
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
