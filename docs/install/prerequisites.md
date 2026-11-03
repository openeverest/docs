# Prerequisites

Before getting started with OpenEverest, we recommend that you:

1. Install [Helm v3  ↗](https://docs.helm.sh/using_helm/#installing-helm) to install OpenEverest using Helm.

2. Install [yq ↗](https://github.com/mikefarah/yq) to install OpenEverest using Helm.

3. Verify that you have access to the Kubernetes cluster that you want to use with OpenEverest. By default, OpenEverest uses the kubeconfig file available under *~/.kube/config*. Run the following command:

    ```sh
    kubectl get nodes
    ```

    <details>
    <summary>Expected output</summary>

    ```
        NAME                                       STATUS   ROLES    AGE   VERSION
        gke-<name>-default-pool-75d48bfc-bx8g      Ready    <none>   11h   v1.26.7-gke.500
        gke-<name>-default-pool-75d48bfc-c2df      Ready    <none>   11h   v1.26.7-gke.500
        gke-<name>-default-pool-75d48bfc-zl7k      Ready    <none>   11h   v1.26.7-gke.500
    ```

    </details>

## Before you install OpenEverest

You can install OpenEverest using one of the following methods:

* [Helm charts](install_everest_helm_charts.md)

* [everestctl](install_everestctl.md), which connects OpenEverest to your Kubernetes cluster.

Once you’ve installed OpenEverest, you can easily log into the OpenEverest UI by following the setup instructions in the next section.

:::tip

OpenEverest assists with installing all the necessary operators and required packages, but does not currently help with spinning up a Kubernetes cluster.

:::

OpenEverest is designed to run on any CNCF-conformant Kubernetes cluster, whether managed by a cloud provider or self-hosted on-premises. See [Supported Kubernetes versions](supported_operators_k8s.md) for the list of tested versions.

<span className="oe-button">[Create EKS cluster →](eks.md)</span>  <span className="oe-button">[Create GKE cluster →](gke.md)</span>

## Next steps

Start by installing OpenEverest:

<span className="oe-button">[Install OpenEverest →](installEverest.md)</span>
