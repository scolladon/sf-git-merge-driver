# summary

Uninstalls the local git merge driver for the given org and branch.

# description

Uninstalls the local git merge driver for the given org and branch, by removing the merge driver content in the `.git/info/attributes` files in the project, deleting the merge driver configuration from the `.git/config` of the project, and removing the installed binary from the node_modules/.bin directory.

# examples

- Uninstall the driver for a given project:

  <%= config.bin %> <%= command.id %>
