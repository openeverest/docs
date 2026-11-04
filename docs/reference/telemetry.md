# Telemetry

OpenEverest sends anonymous usage data to help the project understand how it is used and decide what to build next. Participation is optional, and you can turn it off at any time. Read the Linux Foundation [privacy policy](https://lfprojects.org/policies/privacy-policy/) to learn more.

## What is collected

Periodically, the OpenEverest server sends a report with:

- a random identifier of the installation;
- the OpenEverest version;
- the number of database deployments per technology.

No names, addresses, credentials, configuration or data are collected, and the reports can't be traced back to a person or organization.

## Turn telemetry off

Telemetry is on by default. To turn it off, set the Helm value `telemetry` to `false` when you install OpenEverest:

```sh
helm install everest-core openeverest/openeverest \
  --devel \
  --namespace everest-system \
  --create-namespace \
  --set telemetry=false
```

Or on an existing installation:

```sh
helm upgrade everest-core openeverest/openeverest \
  --namespace everest-system \
  --reuse-values \
  --set telemetry=false
```

This sets the `DISABLE_TELEMETRY` environment variable of the server. Providers may install Operators that have their own telemetry settings — check the provider's README.

To turn telemetry back on, set `telemetry=true`.
