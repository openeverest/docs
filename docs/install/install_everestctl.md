import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Install everestctl

:::info[Important]

Installing `everestctl` is only necessary if you want to use it to install OpenEverest using `everestctl`; it is **not** required if you prefer to install OpenEverest with Helm.

:::

You can download the latest version of `everestctl` visiting the latest release page in [this repository](https://github.com/openeverest/openeverest/releases/latest).

<Tabs>
<TabItem value="homebrew-macos-and-linux" label="Homebrew (macOS and Linux)">

The simplest way to install `everestctl` on macOS or Linux is via Homebrew. This works on both Apple Silicon and Intel CPUs.

1. Add the OpenEverest tap:

    ```sh
    brew tap openeverest/tap
    ```

2. Install `everestctl`:

    ```sh
    brew install everestctl
    ```

</TabItem>
<TabItem value="linux-and-wsl" label="Linux and WSL">

To install `everestctl` on Linux or WSL, run the following commands:

1. Download the latest version of `everestctl`.

    ```sh
    curl -sSL -o everestctl-linux-amd64 https://github.com/openeverest/openeverest/releases/latest/download/everestctl-linux-amd64
    ```

2. Install `everestctl` binary to /usr/local/bin/.

    ```sh
    sudo install -m 555 everestctl-linux-amd64 /usr/local/bin/everestctl
    ```

3. Remove `everestctl` binary to clean up.

    ```sh
    rm everestctl-linux-amd64
    ```         

</TabItem>
<TabItem value="macos-apple-silicon" label="macOS (Apple Silicon)">

To install `everestctl` on macOS with Apple Silicon, run the following commands:

1. Download the latest version of `everestctl` for Apple Silicon.

    ```sh
    curl -sSL -o everestctl-darwin-arm64 https://github.com/openeverest/openeverest/releases/latest/download/everestctl-darwin-arm64
    ```

2. Install `everestctl` binary to /usr/local/bin/.

    ```sh
    sudo install -m 555 everestctl-darwin-arm64 /usr/local/bin/everestctl
    ```
3. Remove `everestctl` binary to clean up

    ```sh
    rm everestctl-darwin-arm64
    ```

</TabItem>
<TabItem value="macos-intel-cpu" label="macOS (Intel CPU)">

To install `everestctl` on macOS with an Intel CPU, run the following commands:

1. Download the latest version of `everestctl` for Intel CPUs.

    ```sh
    curl -sSL -o everestctl-darwin-amd64 https://github.com/openeverest/openeverest/releases/latest/download/everestctl-darwin-amd64
    ```

2. Install `everestctl` binary to /usr/local/bin/.

    ```sh
    sudo install -m 555 everestctl-darwin-amd64 /usr/local/bin/everestctl
    ```

3. Remove `everestctl` to clean up.

    ```sh
    rm everestctl-darwin-amd64
    ```

</TabItem>
</Tabs>

## Next steps

Start by installing OpenEverest:

<span className="oe-button">[Install OpenEverest →](installEverest.md)</span>
