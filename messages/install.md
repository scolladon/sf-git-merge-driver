# summary

Installs a local git merge driver for Salesforce metadata in the current project.

# description

Registers the driver in `.git/config` and adds one merge rule per Salesforce metadata glob to `.git/info/attributes`. Safe to re-run: install is idempotent, preserves any user attributes already on the globs, and dedupes legacy duplicate rules silently.

If another merge driver is already configured on one of our globs, install aborts by default and lists the conflicts. Pass `--on-conflict=skip` to leave those globs to the other driver, `--on-conflict=overwrite` (or `--force`) to take them over (uninstall restores the originals), or run the command from a TTY to be prompted interactively. `--dry-run` previews the plan without writing.

# examples

- Install the driver for a given project:

  <%= config.bin %> <%= command.id %>

- Preview the changes that would be written:

  <%= config.bin %> <%= command.id %> --dry-run

- Take over conflicting globs non-interactively (for CI):

  <%= config.bin %> <%= command.id %> --force

# flags.dry-run.summary

Plan the install without writing to git config or .git/info/attributes. Exits 0; shows the list of rules that would be added/skipped/conflict.

# flags.on-conflict.summary

How to handle patterns already owned by another merge driver in .git/info/attributes. Default: abort (refuse to change anything).

# flags.force.summary

Alias for --on-conflict=overwrite. Non-interactive shortcut for CI.
