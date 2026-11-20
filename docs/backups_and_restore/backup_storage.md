# Backup storage

A backup storage is where OpenEverest writes backups and point-in-time recovery data. Its **type** is a [backup storage class](../crd/backups.md#backupstorageclass), which describes the storage technology. OpenEverest ships the `s3` class, which works with Amazon S3 and with S3-compatible object storage, such as MinIO, SeaweedFS, Ceph RGW or Google Cloud Storage.

A backup storage belongs to a namespace, and every instance in that namespace can use it. Create one per namespace where you want backups. Several storages can point to the same bucket with different prefixes.

:::tip

Give OpenEverest its own bucket, or at least its own prefix, and grant the access key only the permissions it needs on that bucket: list, read, write and delete objects.

:::

## Add a backup storage in the UI

1. Go to **Settings** > **Backups storages** and click **Add storage**.
2. Fill in the form. The storage fields come from the storage type, so they differ between types. For the `s3` type:

    | Field | Description |
    | --- | --- |
    | **Name** | Name of the backup storage. Instances refer to it by this name. |
    | **Namespace** | Namespace the storage is created in. Only instances in this namespace can use it. |
    | **Type** | The storage class, for example **S3-compatible object storage**. |
    | **Bucket**, **Prefix** | The existing bucket, and an optional path within it. They can't be changed after the storage is added. |
    | **Endpoint URL** | URL of the S3 service, for example `https://s3.us-east-1.amazonaws.com` or `https://minio.example.com`. An `http://` URL uses plain HTTP. |
    | **Region** | Region of the bucket, for example `us-east-1`. S3-compatible storage that has no regions usually accepts `us-east-1`. |
    | **Force path-style URLs** | Select for storage that does not support virtual-hosted-style URLs, such as most MinIO installations. |
    | **Implementation** | The S3 implementation: Amazon S3, MinIO, Ceph RGW, Google Cloud Storage or other. Some engines need it to talk to S3-compatible storage. |
    | **Authentication** | How the storage authenticates. Hidden when the type has a single mode, such as **AccessKey** for S3. |
    | **Credentials** | **Enter credentials**, such as the access key ID and secret access key, or **Use an existing Secret**. Entered credentials are stored in the Secret named under **Credentials Secret name**, `backup-storage-<name>-credentials` by default. |
    | **TLS** | For an HTTPS endpoint with a private CA, the **CA certificate Secret** and the **Key in the Secret** that hold the CA certificates. Or select **Skip TLS certificate verification**, for testing only. |

3. Click **Add**.

The storage appears in the list with its status. It is usable once OpenEverest has checked it against its type. If the check fails, the status says why, for example a missing credentials key or an invalid bucket name. OpenEverest doesn't test whether the bucket is reachable: a wrong endpoint or wrong credentials show up when the first backup fails.

To add a storage, you need `create` on `backup-storages`, `read` on its `backup-storage-classes`, and `create` and `use` on the `secrets` it stores the credentials in. See [RBAC](../administer/rbac.md) and [Secrets and credentials](../security/secrets.md).

## Add a backup storage with kubectl

Create the credentials Secret first, then the storage:

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
---
apiVersion: backup.openeverest.io/v1alpha1
kind: BackupStorage
metadata:
  name: s3-backups
  namespace: demo
spec:
  backupStorageClassRef:
    name: s3
  location:
    objectStore:
      bucket: openeverest-backups
      prefix: demo
  parameters:
    region: us-east-1
    endpointURL: https://s3.us-east-1.amazonaws.com
  authentication:
    mode: AccessKey
    credentialsSecretRef:
      name: s3-backups-credentials
```

The labels name the class and the authentication mode the Secret is for. With them, the Secret is listed in the UI and the API, and can be picked for other storages. See [Secrets and credentials](../security/secrets.md).

To reference a Secret from a storage, you need permission to `get` that Secret. Kubernetes' built-in `admin` and `edit` roles include it.

Check that the storage was accepted:

```sh
kubectl get backupstorages -n demo
```

```text
NAME         TYPE   BUCKET                AUTH        ACCEPTED   AGE
s3-backups   s3     openeverest-backups   AccessKey   Accepted   12s
```

For a private CA, put the PEM certificates in a Secret under the key `ca.crt` and reference it from `spec.tls.ca.secretKeyRef`. For all fields and `Accepted` reasons, see [Backups and restores](../crd/backups.md#backupstorage).

## Check a storage before you add it

The API checks a storage without creating it when you add `?dryRun=All` to the request. The answer is the same as for the real write, including validation errors on each field. It works for creating, updating and deleting a storage, and for its credentials Secret.

## Edit or delete a backup storage

On **Settings** > **Backups storages**, open the menu of a storage and select **Edit** or **Delete**.

- You can change the parameters, the credentials and the TLS settings. The type, bucket and prefix can't be changed, because the engines treat them as their backup catalog. Create a new storage instead.
- New credentials replace the ones in the credentials Secret, also for any other storage that uses the same Secret.
- A storage that instances, backups, restores or backup imports still use is not deleted right away. It shows as **Deleting** until nothing uses it. Remove it from the instances' backup settings and delete its backups first.

Deleting a backup storage deletes neither its Secrets nor the data in the bucket.
