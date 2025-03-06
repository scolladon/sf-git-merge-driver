# Salesforce Metadata Git Merge Driver

A custom Git merge driver designed specifically for Salesforce metadata files. This tool helps resolve merge conflicts in Salesforce XML metadata files by understanding their structure and intelligently merging changes.

## Features

- Intelligent merging of Salesforce XML metadata files
- Handles complex metadata structures like arrays with unique identifiers
- Supports both local and global installation
- Easy to use with SFDX CLI plugin commands

## Installation

### As SFDX Plugin

```bash
sf plugins install sf-git-merge-driver
```

### Local Repository Installation

```bash
sf git merge driver install
```

This will:
- Configure your Git settings to use the merge driver
- Add appropriate entries to your `.gitattributes` file
- Set up the driver to handle XML files

## Uninstallation

```bash
sf git merge driver uninstall
```

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
