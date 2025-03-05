# summary

Uninstalls the local git merge driver for the given org and branch.

# description

Uninstalls the local git merge driver for the given org and branch, by removing the merge driver content in the `.gitattributes` files in the project and deleting the merge driver configuration file in the `.git/config` of the project.

# examples

- Uninstall the driver for a given project:

  <%= config.bin %> <%= command.id %>
