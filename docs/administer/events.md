# Lifecycle events

OpenEverest records a lifecycle event every time an object it manages is created, changed, changes state or is deleted, and every time a user logs in or out. Use the events to see who did what and when, to follow an instance through its life, or to feed an audit log or a billing system.

Changes are recorded wherever they come from: the UI, the API, `kubectl` or a GitOps tool such as Argo CD or Flux. OpenEverest watches the objects themselves, not only the API calls.

## What is recorded

Events are recorded for instances, backups, restores, backup imports, backup storages, monitoring destinations, providers, plugins, installed extensions and the namespaces OpenEverest manages.

Every event has one of a few reasons, whatever the kind of object:

| Reason | Recorded when |
| --- | --- |
| `Created` | The object was created. |
| `Updated` | Its spec changed. The event carries the new `generation`. |
| `PhaseChanged` | Its state changed, with `phase.from` and `phase.to`. For an instance, the state is its [status word](../use/instances.md#instance-status), for example from `Creating` to `Ready`, or from `Ready` to `CrashLoopBackOff`. |
| `DeletionRequested` | Someone asked to delete it. It may still exist for a while, for example until its finalizers are released. |
| `Deleted` | It is gone. |
| `LoginSucceeded`, `LoginFailed`, `Logout` | A user logged in, failed to log in, or logged out. The event carries the client IP address. |

An event is a `Warning` when the object moved into a failed state, for example a failed backup or an instance that needs attention. Other events are `Normal`.

Each event names its **actor**:

- `user`, with the subject of the user's token, for changes made through the UI or the API;
- `kubernetes-client`, with the client name, such as `kubectl-client-side-apply`, for changes made directly in Kubernetes;
- `system`, for state changes that OpenEverest records itself.

Events about an instance, its backups and its restores also name the **instance** and its **provider**, so you can find every event of one database or of one technology, even after the instance is deleted.

## Read events through the API

`GET /v1/clusters/{cluster}/events` lists the events of a cluster:

```sh
curl -s -H "Authorization: Bearer $TOKEN" \
  'http://localhost:8080/v1/clusters/main/events?namespaces=demo&kinds=Instance,Backup' | jq
```

```json
{
  "resourceVersion": "184467",
  "items": [
    {
      "name": "orders-db.18a3c0f5e2b7d901",
      "cursor": "184401",
      "occurredAt": "2026-11-20T09:14:02Z",
      "type": "instance.phase-changed",
      "reason": "PhaseChanged",
      "severity": "Normal",
      "cluster": "main",
      "namespace": "demo",
      "object": {"apiVersion": "core.openeverest.io/v1alpha1", "kind": "Instance", "name": "orders-db", "uid": "6f1d…"},
      "actor": {"type": "system", "id": "controller"},
      "phase": {"from": "Creating", "to": "Ready"},
      "instance": "orders-db",
      "provider": "provider-percona-postgresql"
    }
  ]
}
```

| Query parameter | Description |
| --- | --- |
| `namespaces` | Comma-separated namespaces. All namespaces when empty. |
| `kinds` | Comma-separated kinds of objects, for example `Instance,Backup`. |
| `reasons` | Comma-separated reasons, for example `PhaseChanged,Deleted`. |
| `limit`, `continue` | Page through the list, up to 1000 events per page. |
| `watch`, `since` | Stream events, see below. |

### Stream events

With `watch=true`, the endpoint streams events as [Server-Sent Events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events). Each event's `id` is its cursor, its `event` is the event `type`, and its `data` is the event as JSON.

To get every event without gaps:

1. List all pages, following `continue`.
2. Stream with `since` set to the list's `resourceVersion`:

    ```sh
    curl -sN -H "Authorization: Bearer $TOKEN" \
      'http://localhost:8080/v1/clusters/main/events?watch=true&since=184467'
    ```

3. After a disconnect, stream again with `since` set to the last cursor you received.

`bookmark` events only move the cursor forward, so it stays fresh when nothing happens. When a cursor is too old to resume from, the stream sends an `error` event with code `410` and ends. List all pages again and stream from the new `resourceVersion`.

Without `since`, the stream starts with new events only.

## Permissions

Reading events needs the `read-events` action on the object the event is about, in the object's own resource. `read` does not include it.

| Events about | Permission |
| --- | --- |
| Instances | `instances`, `read-events` on `<cluster>/<namespace>/<instance>` |
| Backups, restores | `backups` or `restores`, `read-events` on `<cluster>/<namespace>/<backup or restore>`. Unlike other backup permissions, the object is the backup or the restore itself, not its instance. |
| Backup storages, monitoring destinations, backup imports | `backup-storages`, `monitoring-destinations` or `backup-imports`, `read-events` on `<cluster>/<namespace>/<name>` |
| Providers, plugins, installed extensions, namespaces | `providers`, `plugins`, `installed-extensions` or `namespaces`, `read-events` on `<cluster>/<name>` |
| Logins and logouts | `platform-events`, `read` on `*` |

`role:admin` has all of them. The API returns only the events the user may read. For example, to let an auditor read every event:

```text
p, role:auditor, *, read-events, */*/*
p, role:auditor, *, read-events, */*
p, role:auditor, platform-events, read, *
g, auditor, role:auditor
```

See [Role-based access control](rbac.md).

## Read events with kubectl

Lifecycle events are stored as Kubernetes Events, reported by `openeverest.io/everest`. An event is stored in the namespace of the object it is about. Events about cluster-scoped objects, such as providers, plugins and namespaces, and login events are stored in the `default` namespace.

```sh
kubectl get events -n demo --field-selector reportingComponent=openeverest.io/everest
```

The actor, the instance, the provider and the state change are in the event's `openeverest.io/` annotations:

```sh
kubectl get events -n demo --field-selector reportingComponent=openeverest.io/everest -o yaml
```

## Retention and limitations

- **Events are kept for the cluster's Event TTL**, one hour by default. Most managed Kubernetes services don't let you change it. To keep events longer, stream them to your own storage.
- **A `since` cursor lasts only as long as the API server's watch cache holds it**, often only minutes. A consumer that was offline longer lists the events again instead of resuming.
- **Deletions with `kubectl` have no actor**, and other direct Kubernetes changes name the client rather than the user.
