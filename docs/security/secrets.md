# Secrets and credentials

OpenEverest keeps credentials in Kubernetes Secrets: the access keys of backup storages, the tokens of monitoring destinations, CA certificates, and the user credentials that some providers accept. The UI creates these Secrets for you when you fill in a form. This page explains how they are labelled, how to manage them with the API or `kubectl`, and how OpenEverest protects them.

## Labelled Secrets

OpenEverest works with **labelled Secrets**. The labels say which object defines the Secret's shape — which keys it must hold — and so what it can be used for. A Secret has exactly one source label and an `openeverest.io/definition` label:

| Source label | `openeverest.io/definition` | For | Must hold |
| --- | --- | --- | --- |
| `openeverest.io/provider: <provider>` | A key of the provider's `spec.secrets`, for example `user` | Settings of an instance, such as its initial users | What the provider's definition says |
| `openeverest.io/backup-storage-class: <class>` | An authentication mode of the class, for example `AccessKey` | Backup storage credentials | The keys the mode requires, such as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` |
| `openeverest.io/monitoring-class: <class>` | An authentication mode of the class, for example `ServiceAccountToken` | Monitoring destination credentials | The keys the mode requires, such as `token` |
| none | `ca-bundle` | CA certificates for TLS, usable by any object | PEM CA certificates under `ca.crt`, and nothing else, such as a private key |

Credentials Secrets are of type `Opaque`.

For example, the credentials of an S3 backup storage:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: s3-backups-credentials
  namespace: demo
  labels:
    openeverest.io/backup-storage-class: s3
    openeverest.io/definition: AccessKey
type: Opaque
stringData:
  AWS_ACCESS_KEY_ID: <access key>
  AWS_SECRET_ACCESS_KEY: <secret key>
```

And a CA bundle:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: minio-ca
  namespace: demo
  labels:
    openeverest.io/definition: ca-bundle
type: Opaque
stringData:
  ca.crt: |
    -----BEGIN CERTIFICATE-----
    ...
    -----END CERTIFICATE-----
```

Labelled Secrets are listed in the UI and the API, whoever created them: the API, `kubectl`, a GitOps tool or a secret manager such as External Secrets. A backup storage or monitoring destination can also reference a Secret without labels, such as a CA bundle written by cert-manager. Such a Secret works, but it isn't listed or protected.

## Manage Secrets with the API

The Secrets API is at `/v1/clusters/{cluster}/namespaces/{namespace}/secrets`. It never returns Secret data: responses carry the type, the labels and a few metadata fields only.

| Request | Description |
| --- | --- |
| `GET …/secrets` | Lists labelled Secrets. Filter with `?provider=`, `?backupStorageClass=`, `?monitoringClass=` and `?definition=`, for example `?backupStorageClass=s3&definition=AccessKey`. |
| `GET …/secrets/{name}` | Gets a labelled Secret. An unlabelled Secret is reported as not found. |
| `POST …/secrets` | Creates a Secret. The labels are checked, and the data is checked against the definition. |
| `PATCH …/secrets/{name}` | Changes the data of a Secret, for example to rotate credentials. |
| `DELETE …/secrets/{name}` | Deletes a Secret. |

Create a Secret:

```sh
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  http://localhost:8080/v1/clusters/main/namespaces/demo/secrets \
  -d '{
    "metadata": {
      "name": "s3-backups-credentials",
      "labels": {"openeverest.io/backup-storage-class": "s3", "openeverest.io/definition": "AccessKey"}
    },
    "type": "Opaque",
    "stringData": {"AWS_ACCESS_KEY_ID": "<access key>", "AWS_SECRET_ACCESS_KEY": "<secret key>"}
  }'
```

The API marks the Secrets it creates with `openeverest.io/managed: "true"`. Secrets of type `kubernetes.io/service-account-token` and `bootstrap.kubernetes.io/token` are refused.

### Rotate credentials

`PATCH` takes a JSON merge patch (`Content-Type: application/merge-patch+json`) and changes only the data:

- keys you send are set, keys you leave out keep their value, and `"data": {"<key>": null}` removes a key;
- `metadata.resourceVersion` is required: send the one you read. If the Secret changed since, the patch fails with `409`, so nobody's change is overwritten;
- the result must still match the definition, so you can't remove a key the mode requires.

```sh
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/merge-patch+json' \
  http://localhost:8080/v1/clusters/main/namespaces/demo/secrets/s3-backups-credentials \
  -d '{"metadata": {"resourceVersion": "184467"}, "stringData": {"AWS_SECRET_ACCESS_KEY": "<new secret key>"}}'
```

Every object that references the Secret picks up the new data. Only Secrets created through the API can be patched. The others are managed somewhere else, which would undo the change: the API answers `409` with reason `ManagedByController` for a Secret a controller owns, such as an ExternalSecret, and `ManagedOutside` for any other. Change those at their source.

### Check before you write

Add `?dryRun=All` to a create, patch or delete to check it without changing anything. The answer is the same as for the real request. Forms use it to check a Secret and the object that references it before saving either.

## Secrets in use can't be deleted

OpenEverest counts the monitoring destinations that use each labelled credentials Secret and CA bundle, in the `monitoring.openeverest.io/attached-destinations` annotation. While the count isn't `0`, the Secret holds the `openeverest.io/in-use-protection` finalizer, and deleting it is refused:

- through the API, with `409` and reason `InUse`. The message gives the count and the command that lists the destinations;
- with `kubectl`, by the `secret-in-use.openeverest.io` admission policy.

To find what uses a Secret:

```sh
kubectl get monitoringdestinations -n demo \
  --field-selector spec.authentication.credentialsSecretRef.name=pmm-credentials
kubectl get backupstorages -n demo \
  --field-selector spec.authentication.credentialsSecretRef.name=s3-backups-credentials
```

Use `spec.tls.ca.secretKeyRef.name` as the field to find the users of a CA bundle. Destinations being deleted don't count, so you can delete a destination and its Secret together.

:::note

The Secrets of backup storages and providers are not counted or protected yet. Deleting the credentials Secret of a backup storage that is still in use makes the storage `Accepted=False` with reason `CredentialsNotFound`, and its backups stop until the Secret is back.

:::

To turn the protection off, install OpenEverest with the Helm value `secretProtection.enabled=false`. The controller then removes its finalizer and counts from every Secret.

## Permissions

In the OpenEverest RBAC policy, the `secrets` resource has the object format `<cluster>/<namespace>/<secret>`:

| Action | Allows |
| --- | --- |
| `read` | Listing and getting Secrets. Data is never returned. |
| `create`, `update`, `delete` | Creating, patching and deleting Secrets. |
| `use` | Referencing the Secret from a backup storage or a monitoring destination, or changing the spec of one that references it. `read` is not enough, because the object hands the Secret's contents to whatever it connects to. |

For example, to let a team manage backup storages and their credentials in its namespace:

```text
p, role:team-a, backup-storages, *, main/team-a/*
p, role:team-a, backup-storage-classes, read, */*
p, role:team-a, secrets, *, main/team-a/*
```

Changing only the labels or annotations of a backup storage or a monitoring destination needs no `use`.

With `kubectl` or a GitOps tool, Kubernetes RBAC applies instead. The `secret-reference.openeverest.io` admission policy admits a backup storage or monitoring destination that references Secrets only if the writer may `get` those Secrets. Kubernetes' built-in `admin` and `edit` roles include it; a tenant ServiceAccount used by Flux or Argo CD may need it added.

See [Role-based access control](../administer/rbac.md).
