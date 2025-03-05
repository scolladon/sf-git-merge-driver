# summary

Installs a local git merge driver for the given org and branch.

# description

Installs a local git merge driver for the given org and branch, by updating the `.gitattributes` files in the project and creating a new merge driver configuration file in the `.git/config` of the project.

# examples

- Install the driver for a given project:

  <%= config.bin %> <%= command.id %>
