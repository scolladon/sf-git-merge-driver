# Salesforce Metadata Git Merge Driver

A custom Git merge driver designed specifically for Salesforce metadata files. This tool helps resolve merge conflicts in Salesforce XML metadata files by understanding their structure and intelligently merging changes.

## Features

- Intelligent merging of Salesforce XML metadata files
- Handles complex metadata structures like arrays with unique identifiers
- Supports both local and global installation
- Easy to use with SFDX CLI plugin commands

## Installation

```bash
sf plugins install sf-git-merge-driver
```

## Usage

<!-- commands -->
* [`sf git merge driver install`](#sf-git-merge-driver-install)
* [`sf git merge driver run`](#sf-git-merge-driver-run)
* [`sf git merge driver uninstall`](#sf-git-merge-driver-uninstall)

## `sf git merge driver install`

Installs a local git merge driver for the given org and branch.

```
USAGE
  $ sf git merge driver install [--json] [--flags-dir <value>]

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Installs a local git merge driver for the given org and branch.

  Installs a local git merge driver for the given org and branch, by updating the `.gitattributes` files in the project,
  creating a new merge driver configuration in the `.git/config` of the project, and installing the binary in the
  node_modules/.bin directory.

EXAMPLES
  Install the driver for a given project:

    $ sf git merge driver install
```

_See code: [src/commands/git/merge/driver/install.ts](https://github.com/scolladon/sf-git-merge-driver/blob/v1.0.0/src/commands/git/merge/driver/install.ts)_

## `sf git merge driver run`

Runs the merge driver for the specified files.

```
USAGE
  $ sf git merge driver run -a <value> -o <value> -t <value> -p <value> [--json] [--flags-dir <value>]

FLAGS
  -a, --ancestor-file=<value>  (required) path to the common ancestor version of the file
  -o, --our-file=<value>       (required) path to our version of the file
  -p, --output-file=<value>    (required) path to the file where the merged content will be written
  -t, --theirs-file=<value>    (required) path to their version of the file

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Runs the merge driver for the specified files.

  Runs the merge driver for the specified files, handling the merge conflict resolution using Salesforce-specific merge
  strategies. This command is typically called automatically by Git when a merge conflict is detected.

EXAMPLES
  Run the merge driver for conflicting files:

    $ sf git merge driver run --ancestor-file=<value> --our-file=<value> --theirs-file=<value> --output-file=<value>

  Where:
  - ancestor-file is the path to the common ancestor version of the file
  - our-file is the path to our version of the file
  - their-file is the path to their version of the file
  - output-file is the path to the file where the merged content will be written
```

_See code: [src/commands/git/merge/driver/run.ts](https://github.com/scolladon/sf-git-merge-driver/blob/v1.0.0/src/commands/git/merge/driver/run.ts)_

## `sf git merge driver uninstall`

Uninstalls the local git merge driver for the given org and branch.

```
USAGE
  $ sf git merge driver uninstall [--json] [--flags-dir <value>]

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Uninstalls the local git merge driver for the given org and branch.

  Uninstalls the local git merge driver for the given org and branch, by removing the merge driver content in the
  `.gitattributes` files in the project, deleting the merge driver configuration from the `.git/config` of the project,
  and removing the installed binary from the node_modules/.bin directory.

EXAMPLES
  Uninstall the driver for a given project:

    $ sf git merge driver uninstall
```

_See code: [src/commands/git/merge/driver/uninstall.ts](https://github.com/scolladon/sf-git-merge-driver/blob/v1.0.0/src/commands/git/merge/driver/uninstall.ts)_
<!-- commandsstop -->


## How It Works

The merge driver works by:
1. Converting XML to JSON for easier processing
2. Using a specialized three-way merge algorithm that understands Salesforce metadata structures
3. Intelligently resolving conflicts based on metadata type
4. Converting the merged result back to properly formatted XML

## Configuration

The driver is configured to work with `.xml` files by default. The installation adds the following to your `.gitattributes` file:

```
*.xml merge=salesforce-source
```

## Changelog

[changelog.md](CHANGELOG.md) is available for consultation.

## Versioning

Versioning follows [SemVer](http://semver.org/) specification.

## Authors

- **Kevin Gossent** - [yohanim](https://github.com/yohanim)
- **Sebastien Colladon** - [scolladon](https://github.com/scolladon)

## Contributing

Contributions are what make the trailblazer community such an amazing place. I regard this component as a way to inspire and learn from others. Any contributions you make are **appreciated**.

See [contributing.md](CONTRIBUTING.md) for sgd contribution principles.

## License

This project license is MIT - see the [LICENSE.md](LICENSE.md) file for details
