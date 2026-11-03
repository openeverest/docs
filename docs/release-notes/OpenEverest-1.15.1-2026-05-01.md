# What's new in OpenEverest 1.15.1

**New to OpenEverest?** Get started with our [Quickstart Guide](../quick-install.md).

---

## Release highlights

This is a patch release that fixes a bug in the ARM64 support introduced in 1.15.0. ARM64 was not supported in any prior release. On ARM-based clusters, the installation completed successfully and all backend components started normally, but the web UI was not functional — users connecting via `kubectl port-forward` would see a blank page instead of the interface. The root cause was that the UI build steps in the release pipeline were accidentally gated to AMD64 only, so ARM images shipped without a built frontend.

---

## Changes

### Fixed

- [#2110](https://github.com/openeverest/openeverest/pull/2110): Fixed a regression introduced in 1.15.0 where the web UI was not built for ARM images. On affected clusters, Everest installed and started correctly, but connecting to the UI (e.g. via `kubectl port-forward`) showed a blank page. This was caused by the UI build steps being incorrectly restricted to AMD64 in the release pipeline.

---

## Upgrade to OpenEverest 1.15.1

### Using everestctl

```sh
everestctl upgrade
```

### Using Helm directly

```sh
helm repo update openeverest
helm upgrade everest openeverest/everest -n everest-system
```

---

**Full Changelog**: https://github.com/openeverest/openeverest/compare/v1.15.0...v1.15.1
