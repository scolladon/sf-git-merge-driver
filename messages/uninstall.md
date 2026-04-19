# summary

Uninstalls the local git merge driver from the current project.

# description

Removes the `merge.salesforce-source` section from `.git/config` and strips the driver's rules from `.git/info/attributes`. Lines that combined the driver with user attributes (e.g. `*.profile-meta.xml text=auto merge=salesforce-source`) are rewritten to keep the user attributes; only the `merge=` token is removed. If a previous install used `--on-conflict=overwrite`, the original driver rule is restored from the annotation comment written at install time. `--dry-run` previews the plan without writing.

# examples

- Uninstall the driver for a given project:

  <%= config.bin %> <%= command.id %>

- Preview the changes that would be written:

  <%= config.bin %> <%= command.id %> --dry-run
