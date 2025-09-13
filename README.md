# Salesforce Metadata Git Merge Driver

A custom Git merge driver designed specifically for Salesforce metadata files. This tool helps resolve merge conflicts in Salesforce XML metadata files by understanding their structure and intelligently merging changes.

## Features

- Intelligent merging of Salesforce XML metadata files
- Handles complex metadata structures like arrays with unique identifiers
- Supports both local and global installation
- Easy to use with SFDX CLI plugin commands
- Warning: as of now it does not preserve the order of items that are order dependant like valuesets

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

  Installs a local git merge driver for the given org and branch, by updating the `.git/info/attributes` files in the
  project, creating a new merge driver configuration in the `.git/config` of the project, and installing the binary in
  the node_modules/.bin directory.

EXAMPLES
  Install the driver for a given project:

    $ sf git merge driver install
```

_See code: [src/commands/git/merge/driver/install.ts](https://github.com/scolladon/sf-git-merge-driver/blob/main/src/commands/git/merge/driver/install.ts)_

## `sf git merge driver run`

Runs the merge driver for the specified files.

```
USAGE
  $ sf git merge driver run -O <value> -A <value> -B <value> -P <value> [--json] [--flags-dir <value>] [-L <value>] [-S
    <value>] [-X <value>] [-Y <value>]

FLAGS
  -A, --local-file=<value>             (required) path to our version of the file
  -B, --other-file=<value>             (required) path to their version of the file
  -L, --conflict-marker-size=<value>   [default: 7] number of characters to show for conflict markers
  -O, --ancestor-file=<value>          (required) path to the common ancestor version of the file
  -P, --output-file=<value>            (required) path to the file where the merged content will be written
  -S, --ancestor-conflict-tag=<value>  [default: BASE] string used to tag ancestor version in conflicts
  -X, --local-conflict-tag=<value>     [default: LOCAL] string used to tag local version in conflicts
  -Y, --other-conflict-tag=<value>     [default: REMOTE] string used to tag other version in conflicts

GLOBAL FLAGS
  --flags-dir=<value>  Import flag values from a directory.
  --json               Format output as json.

DESCRIPTION
  Runs the merge driver for the specified files.

  Runs the merge driver for the specified files, handling the merge conflict resolution using Salesforce-specific merge
  strategies. This command is typically called automatically by Git when a merge conflict is detected.

EXAMPLES
  Run the merge driver for conflicting files:

    $ sf git merge driver run --ancestor-file=<value> --local-file=<value> --other-file=<value> \
      --output-file=<value>

  Where:
  - ancestor-file is the path to the common ancestor version of the file
  - local-file is the path to our version of the file
  - other-file is the path to their version of the file
  - output-file is the path to the file where the merged content will be written
```

_See code: [src/commands/git/merge/driver/run.ts](https://github.com/scolladon/sf-git-merge-driver/blob/main/src/commands/git/merge/driver/run.ts)_

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
  `.git/info/attributes` files in the project, deleting the merge driver configuration from the `.git/config` of the
  project, and removing the installed binary from the node_modules/.bin directory.

EXAMPLES
  Uninstall the driver for a given project:

    $ sf git merge driver uninstall
```

_See code: [src/commands/git/merge/driver/uninstall.ts](https://github.com/scolladon/sf-git-merge-driver/blob/main/src/commands/git/merge/driver/uninstall.ts)_
<!-- commandsstop -->

## How It Works

The merge driver works by:
1. Converting XML to JSON for easier processing
2. Using a specialized three-way merge algorithm that understands Salesforce metadata structures
3. Intelligently resolving conflicts based on metadata type
4. Converting the merged result back to properly formatted XML

## Configuration

The driver is configured to work with `.xml` files by default. The installation adds the following to the `.git/info/attributes` file (so it is discrete for the current repo):

```
*.labels-meta.xml merge=salesforce-source
*.label-meta.xml merge=salesforce-source
*.profile-meta.xml merge=salesforce-source
*.permissionset-meta.xml merge=salesforce-source
*.applicationVisibility-meta.xml merge=salesforce-source
*.classAccess-meta.xml merge=salesforce-source
*.customMetadataTypeAccess-meta.xml merge=salesforce-source
*.customPermission-meta.xml merge=salesforce-source
*.customSettingAccess-meta.xml merge=salesforce-source
*.externalCredentialPrincipalAccess-meta.xml merge=salesforce-source
*.externalDataSourceAccess-meta.xml merge=salesforce-source
*.fieldPermission-meta.xml merge=salesforce-source
*.flowAccess-meta.xml merge=salesforce-source
*.objectPermission-meta.xml merge=salesforce-source
*.pageAccess-meta.xml merge=salesforce-source
*.recordTypeVisibility-meta.xml merge=salesforce-source
*.tabSetting-meta.xml merge=salesforce-source
*.userPermission-meta.xml merge=salesforce-source
*.objectSettings-meta.xml merge=salesforce-source
*.permissionsetgroup-meta.xml merge=salesforce-source
*.permissionSetLicenseDefinition-meta.xml merge=salesforce-source
*.mutingpermissionset-meta.xml merge=salesforce-source
*.sharingRules-meta.xml merge=salesforce-source
*.sharingCriteriaRule-meta.xml merge=salesforce-source
*.sharingGuestRule-meta.xml merge=salesforce-source
*.sharingOwnerRule-meta.xml merge=salesforce-source
*.sharingTerritoryRule-meta.xml merge=salesforce-source
*.workflow-meta.xml merge=salesforce-source
*.workflowAlert-meta.xml merge=salesforce-source
*.workflowFieldUpdate-meta.xml merge=salesforce-source
*.workflowFlowAction-meta.xml merge=salesforce-source
*.workflowKnowledgePublish-meta.xml merge=salesforce-source
*.workflowOutboundMessage-meta.xml merge=salesforce-source
*.workflowRule-meta.xml merge=salesforce-source
*.workflowSend-meta.xml merge=salesforce-source
*.workflowTask-meta.xml merge=salesforce-source
*.assignmentRules-meta.xml merge=salesforce-source
*.autoResponseRules-meta.xml merge=salesforce-source
*.escalationRules-meta.xml merge=salesforce-source
*.marketingappextension-meta.xml merge=salesforce-source
*.matchingRule-meta.xml merge=salesforce-source
*.globalValueSet-meta.xml merge=salesforce-source
*.standardValueSet-meta.xml merge=salesforce-source
*.globalValueSetTranslation-meta.xml merge=salesforce-source
*.standardValueSetTranslation-meta.xml merge=salesforce-source
*.translation-meta.xml merge=salesforce-source
*.objectTranslation-meta.xml merge=salesforce-source
```

## Debugging

The plugin uses the [Salesforce CLI logging system](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_dev_cli_log_messages.htm) to log information.
You can control the logging level by setting the `SFDX_LOG_LEVEL` environment variable.
You can redirect the logging in the terminal using `DEBUG=sf-git-merge-driver`.

You can also use `GIT_TRACE=1` to get more information about git operations.
You can also use `GIT_MERGE_VERBOSITY=5` to get more information about the merge process.
Git environment variables are detailed [here](https://git-scm.com/book/en/v2/Git-Internals-Environment-Variables).

Example:

```sh
DEBUG=sf-git-merge-driver
SFDX_LOG_LEVEL=trace # can be error | warn | info | debug | trace, default: warn
GIT_MERGE_VERBOSITY=5 # can be 0 to 5
GIT_TRACE=true
git merge ...
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
