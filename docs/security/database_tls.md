# TLS for database instances

Database instances encrypt connections with TLS. By default the provider, or the operator behind it, creates a CA for each instance and signs the instance's certificates with it. Clients can connect over TLS, but to verify the server they need that per-instance CA.

You can instead have the certificates signed by your own CA. For example, a company wants its `company.com` CA to sign database certificates, so that applications connect to `orders-db.company.com` with full verification and trust only the company CA.

Every provider exposes this through the same fields, in `spec.parameters.tls` of the instance:

```yaml
spec:
  parameters:
    tls:
      mode: requireTLS                     # preferTLS | requireTLS | disabled
      certificateSecretName: orders-db-tls # your certificate in a Secret, or:
      issuer:                              # a cert-manager issuer that signs it
        name: company-ca
        kind: ClusterIssuer                # Issuer (default) | ClusterIssuer
        group: cert-manager.io             # optional, for external issuers
      additionalNames:                     # DNS names clients connect to
        - orders-db.company.com
```

:::note[Provider support]

Each provider supports the fields and modes its database engine can honour, and refuses the others when the instance is created or changed, with a message saying why. For example, PostgreSQL always serves TLS, so the CloudNativePG provider doesn't accept `mode: disabled`. Check the documentation of your provider.

:::

## Fields

| Field | Description | Can change after creation |
| --- | --- | --- |
| `mode` | Which client connections must use TLS. `preferTLS` (the default) lets clients choose, `requireTLS` rejects unencrypted clients, and `disabled` turns TLS off where the engine allows it. | Yes, except to or from `disabled` |
| `certificateSecretName` | A Secret in the instance's namespace with the server certificate (`tls.crt`), its private key (`tls.key`) and the CA certificate clients verify it with (`ca.crt`). | No |
| `internalCertificateSecretName` | A Secret in the same format with the certificate the instance's members use to authenticate each other, where the engine separates it from the server certificate. | No |
| `issuer` | A [cert-manager](https://cert-manager.io/) issuer that signs the server certificate. The provider requests the certificate and cert-manager renews it. | No |
| `additionalNames` | DNS names the server certificate is valid for, besides the names of the instance's services. DNS names only, no IP addresses. Not with `certificateSecretName`, whose certificate carries its own names. | Yes |

The server certificate comes from, in this order of precedence:

1. `certificateSecretName`;
2. `issuer`;
3. otherwise, a CA the provider or operator creates for the instance.

The certificates in the Secrets can be renewed at any time. Where to get the certificates from (`certificateSecretName`, `internalCertificateSecretName` and `issuer`) can only be chosen when the instance is created.

## Bring your own CA with cert-manager

This is the recommended way: cert-manager issues the certificates and renews them before they expire.

### Prerequisites

- [cert-manager](https://cert-manager.io/docs/installation/) is installed in the cluster.
- The provider of your instance supports `spec.parameters.tls.issuer`.

### 1. Make the company CA available to cert-manager

Do this once per Kubernetes cluster. If the CA's private key can be stored in the cluster, create a [CA issuer](https://cert-manager.io/docs/configuration/ca/) with it:

```sh
kubectl create secret tls company-ca -n cert-manager \
  --cert=company-ca.crt --key=company-ca.key
```

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: company-ca
spec:
  ca:
    secretName: company-ca
```

If the CA's private key must stay outside the cluster, use a [Vault issuer](https://cert-manager.io/docs/configuration/vault/) or an [external issuer](https://cert-manager.io/docs/configuration/issuers/), such as AWS Private CA or Google CAS. For an external issuer, set `issuer.group` to its API group, for example `awspca.cert-manager.io`.

The issuer must write its CA certificate to `ca.crt` in the certificate's Secret, as the CA and Vault issuers do: clients and the database verify the server certificate with it. ACME issuers, such as Let's Encrypt, don't.

### 2. Create the instance

Create the instance with the issuer, and with the names clients will connect to in `additionalNames`. For example, a PostgreSQL instance of the CloudNativePG provider:

```yaml
apiVersion: core.openeverest.io/v1alpha1
kind: Instance
metadata:
  name: orders-db
  namespace: demo
spec:
  providerRef:
    name: provider-cloudnative-pg
  parameters:
    tls:
      mode: requireTLS
      issuer:
        name: company-ca
        kind: ClusterIssuer
      additionalNames:
        - orders-db.company.com
  components:
    engine:
      type: postgresql
      replicas: 3
      resources:
        requests:
          cpu: "1"
          memory: 1Gi
        limits:
          cpu: "1"
          memory: 1Gi
      storage:
        size: 5Gi
```

In the UI, the **TLS** section of the instance form has the mode and the issuer. Until the UI can edit lists, set `additionalNames` in the YAML or through the API.

The provider requests a cert-manager `Certificate` for the names of the instance's services and for `additionalNames`, and starts the database once cert-manager has issued it. If the issuer doesn't exist or isn't ready, the instance's status says so. To see the certificate:

```sh
kubectl get certificate -n demo
```

### 3. Point the DNS name at the instance

Make the instance reachable from where clients run, for example with a `LoadBalancer` service. See [Connect from outside the cluster](../use/connect.md#connect-from-outside-the-cluster). Then create a DNS record for `orders-db.company.com` that points at the address of that service, in your DNS provider or with [ExternalDNS](https://github.com/kubernetes-sigs/external-dns).

### 4. Connect with full verification

Clients verify the server with the company CA certificate. The provider also publishes the CA certificate as `ca.crt` in the instance's connection Secret, `<instance>-conn`:

```sh
kubectl get secret orders-db-conn -n demo -o jsonpath='{.data.ca\.crt}' | base64 --decode > ca.crt
psql "host=orders-db.company.com user=app dbname=app sslmode=verify-full sslrootcert=ca.crt"
```

With `sslmode=verify-full`, the client checks that the certificate is signed by the CA and that it is valid for `orders-db.company.com`.

### Renewal and new names

cert-manager renews the certificate before it expires, and the database loads the renewed certificate. To add a name, append it to `additionalNames`. The provider then has the certificate issued again.

Whether loading a new certificate restarts the database depends on the engine. Where it does, the provider holds the restart until it is approved, as described in [Maintenance and disruptive changes](../use/manage_instances.md#maintenance-and-disruptive-changes).

## Bring your own certificate in a Secret

If you issue certificates with your own tools, put them in Secrets and reference them. You then renew them yourself.

### 1. Issue the server certificate

Issue a certificate from your CA for server authentication. Its subject alternative names must cover the names clients connect to: the external names, such as `orders-db.company.com`, and the instance's service names inside the cluster, such as `orders-db-rw.demo.svc` for the CloudNativePG provider. Your provider's documentation lists its service names.

### 2. Create the Secret

Create the Secret in the instance's namespace:

```sh
kubectl create secret generic orders-db-tls -n demo \
  --from-file=tls.crt=server-fullchain.crt \
  --from-file=tls.key=server.key \
  --from-file=ca.crt=company-root-ca.crt
```

- `tls.crt` is the server certificate, followed by any intermediate CA certificates.
- `tls.key` is its private key.
- `ca.crt` is the root CA certificate. Most clients trust a chain only if it ends at a self-signed root CA.

### 3. Create the instance

```yaml
spec:
  parameters:
    tls:
      mode: requireTLS
      certificateSecretName: orders-db-tls
```

The instance waits until the Secret exists. Providers check the certificate in the Secret, for example that the key matches it and that it chains to `ca.crt`, and report what is wrong in the instance's status.

Where the engine supports it, `internalCertificateSecretName` names a second Secret, in the same format, with the certificate the instance's members authenticate each other with. Its requirements depend on the engine. For example, with the CloudNativePG provider it is the client certificate replicas authenticate to the primary with: issued to the `streaming_replica` user (common name) for client authentication, and signed by the CA in its own `ca.crt`.

### 4. Connect and renew

Connect as in [Connect with full verification](#4-connect-with-full-verification).

To renew the certificate, write the new certificate and key into the same Secret, with your own tooling or with a cert-manager `Certificate` that writes to it. The provider has the database load it.
