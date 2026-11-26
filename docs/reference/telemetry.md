# Telemetry

OpenEverest sends anonymous usage data to help the project understand how it is used and decide what to build next. Participation is optional, and you can turn it off at any time. Read the Linux Foundation [privacy policy](https://lfprojects.org/policies/privacy-policy/) to learn more.

## What is collected

Once a day, the OpenEverest server sends one report. It contains counts and totals only:

| Key | Value |
| --- | --- |
| `instance_id` | A random identifier of the installation: the UID of the namespace OpenEverest is installed in. |
| `openeverest_version`, `contract_version` | The OpenEverest version and the version of its provider contract. |
| `build_channel` | `release` or `rc`. |
| `clusters_total`, `clusters_stale` | The clusters the installation manages. |
| `providers_distinct`, `providers`, `provider_installations` | The providers installed. |
| `provider.<name>.instances` | Instances per provider. |
| `plugins_total`, `plugin.<name>` | The plugins installed. |
| `instances_total`, `instances_ready`, `instances_stalled`, `namespaces_with_instances` | How many instances there are and in what state. |
| `cpu_requested_cores`, `memory_requested_bytes`, `storage_requested_bytes` | The resources the instances request. |
| `backups_succeeded`, `backups_failed`, `restores_total`, `instances_with_backup_storage`, `instances_with_pitr` | Backup and restore usage. |
| `monitoring_classes`, `monitoring_destinations`, `monitoring_bindings`, `backup_classes`, `backup_storage_classes`, `backup_storages` | Monitoring and backup integrations in use. |

Providers and plugins are named only when they are in the official [OpenEverest Hub](https://github.com/openeverest/hub) catalog; any other provider is counted as `custom`, and any other plugin only in `plugins_total`.

No names of namespaces, instances, storages or anything else you name, no addresses, credentials, configuration or data are collected, and the reports can't be traced back to a person or organization.

To see the exact report, turn on the dry run: the server then writes the report to its log instead of sending it.

```sh
helm upgrade everest-core openeverest/openeverest \
  --namespace everest-system \
  --reuse-values \
  --set telemetry.dryRun=true
```

The first report comes 5 minutes after the server starts:

```sh
kubectl logs -n everest-system deploy/everest-server | grep "Telemetry dry run"
```

## Turn telemetry off

Telemetry is on by default in OpenEverest releases. When the server starts, it logs whether telemetry is on, where it sends the report and how to turn it off.

To turn it off, set the Helm value `telemetry.enabled` to `false` when you install OpenEverest:

```sh
helm install everest-core openeverest/openeverest \
  --namespace everest-system \
  --create-namespace \
  --set telemetry.enabled=false
```

Or on an existing installation:

```sh
helm upgrade everest-core openeverest/openeverest \
  --namespace everest-system \
  --reuse-values \
  --set telemetry.enabled=false
```

The older form `--set telemetry=false` works too, and so does `everestctl install --disable-telemetry`. `everestctl upgrade` keeps telemetry off once you have turned it off.

Telemetry is also off when the server's environment sets `DISABLE_TELEMETRY=true` or the cross-tool [`DO_NOT_TRACK=1`](https://consoledonottrack.com).

Providers may install Operators that have their own telemetry settings — check the provider's README.

## Send the report elsewhere

To send the report to your own collector, or through your proxy, set `telemetry.url`. The report is one HTTP `POST` with a JSON object of string values.

```sh
helm upgrade everest-core openeverest/openeverest \
  --namespace everest-system \
  --reuse-values \
  --set telemetry.url=https://collector.example.com/openeverest
```

`telemetry.interval` changes how often it is sent, at least `1h`.
