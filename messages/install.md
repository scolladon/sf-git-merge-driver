# summary

Installs a local git merge driver for the given org and branch.

# description

Installs a local git merge driver for the given org and branch, by updating the `.gitattributes` files in the project, creating a new merge driver configuration in the `.git/config` of the project, and installing the binary in the node_modules/.bin directory.

# examples

- Install the driver for a given project:

  <%= config.bin %> <%= command.id %>
