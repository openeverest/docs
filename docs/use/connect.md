# Connect to an instance

## Get the connection details

### In the UI

Open the instance. The **Connection Details** card on the **Overview** tab shows the **Host**, **Port**, **Username** and **Password**, and a ready-to-use **Connection URL**. Use the copy buttons to copy each value.

Seeing the password requires the `read-connection` permission on the instance. Users with read-only access see the instance but not its credentials. See [RBAC](../administer/rbac.md).

### With kubectl

For every instance, OpenEverest creates a Secret named `<instance>-conn` in the instance's namespace. It uses the same keys for every technology:

| Key | Content |
| --- | --- |
| `type` | The technology, for example `postgresql` or `mongodb`. |
| `provider` | The provider that manages the instance. |
| `host` | Host name of the instance's service inside the cluster. |
| `port` | Port number. |
| `username` | User name. |
| `password` | Password. |
| `uri` | Full connection URI, including the credentials. |

For example, to print the connection URI of `orders-db`:

```sh
kubectl get secret orders-db-conn -n demo -o jsonpath='{.data.uri}' | base64 --decode
```

Applications running in Kubernetes can mount this Secret or read single keys from it as environment variables, so they don't need to know which technology or provider they are talking to.

### With the API

```sh
curl -H "Authorization: Bearer $TOKEN" \
  https://everest.example.com/v1/clusters/main/namespaces/demo/instances/orders-db/connection
```

See [API](../API.md).

## Connect from inside the cluster

The `host` in the connection details is a Kubernetes service name, such as `orders-db-pgbouncer.demo.svc`. Applications in the same cluster can connect to it directly.

## Connect from outside the cluster

By default, instances are reachable only from inside the cluster. You have two options:

- **Expose the instance.** Providers that support it have an exposure setting — for example **Exposure** in the *Proxy* step of the PostgreSQL provider — where you can choose a `LoadBalancer` or `NodePort` service instead of `ClusterIP`. Change it when you create the instance, or later with **Edit** on the overview card. Restrict access with your cloud provider's load balancer settings or network policies: an exposed instance is reachable by anyone who can reach the load balancer.
- **Forward a port** for a temporary connection from your machine. Use the service from the `host` value:

    ```sh
    kubectl port-forward svc/orders-db-pgbouncer 5432:5432 -n demo
    ```

    Then connect to `localhost:5432` with the user name and password from the connection details.

## Change the credentials

To set the initial credentials yourself instead of letting the provider generate them, reference a Secret in `spec.userSecretRef` when you create the instance. See [Instance](../crd/instance.md).
