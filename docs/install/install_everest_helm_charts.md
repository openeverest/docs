import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Install OpenEverest

OpenEverest is installed with Helm in two parts:

1. **The core** — the `openeverest/openeverest` chart. It installs the server (UI and API), the controller, the custom resource definitions and the Plugin Hub into the `everest-system` namespace.
2. **One or more providers** — one chart per technology. See [Add providers](install_providers.md).

:::warning[Developer Preview]

OpenEverest 2 is a Developer Preview. Install it on a fresh cluster: there is no upgrade path from OpenEverest 1.x yet, and running 1.x and 2 in the same cluster is not supported.

:::

Check the [prerequisites](prerequisites.md) first.

## Install the core

1. Add the OpenEverest Helm repository:

    ```sh
    helm repo add openeverest https://openeverest.github.io/helm-charts/
    helm repo update
    ```

2. Install the chart:

    ```sh
    helm install everest-core openeverest/openeverest \
      --devel \
      --namespace everest-system \
      --create-namespace
    ```

    `--devel` lets Helm select pre-release versions. To install a specific version, add `--version`, for example `--version 2.0.0-dev.4`. List the available versions with `helm search repo openeverest/openeverest --devel --versions`.

3. Check that the core is running:

    ```sh
    kubectl get pods -n everest-system
    ```

    ```text
    NAME                                      READY   STATUS    RESTARTS   AGE
    everest-controller-5474b99686-mw5c9       1/1     Running   0          40s
    everest-core-plugin-hub-566d44f99-k7554   1/1     Running   0          40s
    everest-server-7b6db64b79-728z8           1/1     Running   0          40s
    ```

4. [Add at least one provider](install_providers.md). Without providers, OpenEverest has no technology to deploy.

## Log in

OpenEverest creates an `admin` user during installation. Unless you set a password, it generates a random one:

```sh
kubectl get secret everest-accounts -n everest-system \
  -o jsonpath='{.data.users\.yaml}' | base64 --decode | yq '.admin.passwordHash'
```

:::note

In the Developer Preview, the initial password is stored in this Secret in plain text. Change it after your first login — see [Users](../administer/manage_users.md).

:::

## Expose OpenEverest

The `everest` service has the type `ClusterIP` by default, so OpenEverest is not reachable from outside the cluster. Choose one of the options below.

<Tabs>
<TabItem value="port-forwarding" label="Port forwarding">

Good for testing. Forward the service to your machine:

```sh
kubectl port-forward svc/everest 8080:8080 -n everest-system
```

Open [http://localhost:8080](http://localhost:8080). With TLS enabled, forward port 443 instead and open `https://localhost:8443`:

```sh
kubectl port-forward svc/everest 8443:443 -n everest-system
```

</TabItem>
<TabItem value="load-balancer" label="Load balancer">

Change the service type to `LoadBalancer`:

```sh
helm upgrade everest-core openeverest/openeverest \
  --namespace everest-system \
  --reuse-values \
  --set server.service.type=LoadBalancer
```

Get the external address once the load balancer is provisioned:

```sh
kubectl get svc everest -n everest-system
```

```text
NAME      TYPE           CLUSTER-IP      EXTERNAL-IP      PORT(S)          AGE
everest   LoadBalancer   10.43.172.194   34.175.201.246   8080:31925/TCP   10s
```

Open `http://<EXTERNAL-IP>:8080`. To select a load balancer implementation, set `server.service.loadBalancerClass`.

</TabItem>
<TabItem value="ingress" label="Ingress">

You need an Ingress controller in the cluster. Enable the Ingress in the chart and set your host name:

```yaml title="everest-values.yaml"
ingress:
  enabled: true
  ingressClassName: nginx
  hosts:
    - host: everest.example.com
      paths:
        - path: /
          pathType: ImplementationSpecific
  tls:
    - secretName: everest-tls
      hosts:
        - everest.example.com
```

```sh
helm upgrade everest-core openeverest/openeverest \
  --namespace everest-system \
  --reuse-values \
  -f everest-values.yaml
```

Check that the Ingress has an address:

```sh
kubectl get ingress -n everest-system
```

</TabItem>
<TabItem value="node-port" label="NodePort">

Change the service type to `NodePort`:

```sh
helm upgrade everest-core openeverest/openeverest \
  --namespace everest-system \
  --reuse-values \
  --set server.service.type=NodePort
```

Find the assigned port and the address of any node:

```sh
kubectl get svc everest -n everest-system
kubectl get nodes -o wide
```

Open `http://<node-address>:<node-port>`.

</TabItem>
</Tabs>

## Configure the installation

You can pass values with `--set` or with a values file (`-f values.yaml`). The most common ones:

| Value | Default | Description |
| --- | --- | --- |
| `server.initialAdminPassword` | random | Password of the `admin` user created at installation. |
| `server.service.type` | `ClusterIP` | Type of the `everest` service: `ClusterIP`, `NodePort` or `LoadBalancer`. |
| `server.tls.enabled` | `false` | Serve the UI and API over HTTPS. See [TLS](../security/tls_setup.md). |
| `server.oidc.issuerUrl`, `server.oidc.clientId` | — | Enable single sign-on at installation. See [Single sign-on](../security/sso_idp_integration.md). |
| `server.rbac.enabled`, `server.rbac.policy` | `false` | Enable role-based access control at installation. See [RBAC](../administer/rbac.md). |
| `server.apiRequestsRateLimit` | `100` | API requests allowed per second. See [API rate limiting](../use/API_rate_limit.md). |
| `ingress.*` | disabled | Ingress for the UI and API. |
| `plugins.hub.enabled` | `true` | Install the [Plugin Hub](../extend/hub.md). |
| `telemetry` | `true` | Send anonymous usage data. See [Telemetry](../reference/telemetry.md). |

`server.initialAdminPassword`, `server.oidc` and `server.rbac` are applied at installation only. To change these settings later, follow the linked pages.

To see every available value:

```sh
helm show values openeverest/openeverest --devel
```

## Next steps

<span className="oe-button">[Add providers →](install_providers.md)</span>  <span className="oe-button">[Create an instance →](../use/create_instance.md)</span>
