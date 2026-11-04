# Backup storage

A backup storage is an S3-compatible bucket where OpenEverest writes backups and point-in-time recovery data. It works with Amazon S3 and with any S3-compatible object storage, such as MinIO, SeaweedFS or Ceph.

A backup storage belongs to a namespace, and every instance in that namespace can use it. Create one per namespace where you want backups — several storages can point to the same bucket.

:::tip

Give OpenEverest its own bucket, or at least its own prefix, and grant the access key only the permissions it needs on that bucket: list, read, write and delete objects.

:::

## Add a backup storage in the UI

1. Go to **Settings** > **Backups storages** and click **Add backup storage**.
2. Fill in the form:

    | Field | Description |
    | --- | --- |
    | **Name** | Name of the backup storage. Instances refer to it by this name. |
    | **Namespace** | Namespace the storage is created in. Only instances in this namespace can use it. |
    | **Bucket Name** | Name of the existing bucket. |
    | **Region** | Region of the bucket, for example `us-east-1`. S3-compatible storage that has no regions usually accepts `us-east-1`. |
    | **Endpoint** | URL of the S3 service, for example `https://s3.us-east-1.amazonaws.com` or `https://minio.example.com`. |
    | **Access Key**, **Secret Key** | Credentials with access to the bucket. |
    | **Verify TLS certificate** | Clear only for endpoints with self-signed certificates. |
    | **Force path-style URL access** | Select for storage that does not support virtual-hosted-style URLs, such as most MinIO installations. |

3. Click **Add**.

OpenEverest stores the credentials in a Kubernetes Secret in the same namespace. They are never shown again in the UI.

## Add a backup storage with kubectl

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: s3-backups-credentials
  namespace: demo
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
  type: s3
  s3:
    bucket: openeverest-backups
    region: us-east-1
    endpointURL: https://s3.us-east-1.amazonaws.com
    credentialsSecretRef:
      name: s3-backups-credentials
```

Check that the storage was accepted:

```sh
kubectl get backupstorages -n demo
```

## Edit or delete a backup storage

On **Settings** > **Backups storages**, open the menu of a storage and select **Edit** or **Delete**.

- Changing the bucket or endpoint of a storage that already holds backups makes those backups unreachable for restores. Create a new storage instead.
- A storage that is still used by an instance or referenced by a backup is not deleted: it stays in the **Terminating** state until nothing uses it. Remove it from the instances' backup settings and delete or move its backups first.

Deleting a backup storage does not delete the data in the bucket.
