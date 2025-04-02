# summary

Runs the merge driver for the specified files.

# description

Runs the merge driver for the specified files, handling the merge conflict resolution using Salesforce-specific merge strategies. This command is typically called automatically by Git when a merge conflict is detected.

# examples

- Run the merge driver for conflicting files:

  <%= config.bin %> <%= command.id %> --ancestor-file=<value> --our-file=<value> --theirs-file=<value> --output-file=<value>

- Where:
  - ancestor-file is the path to the common ancestor version of the file
  - our-file is the path to our version of the file
  - their-file is the path to their version of the file
  - output-file is the path to the file where the merged content will be written

# flags.ancestor-file.summary

path to the common ancestor version of the file

# flags.our-file.summary

path to our version of the file

# flags.theirs-file.summary

path to their version of the file

# flags.output-file.summary

path to the file where the merged content will be written

# result.withconflict

There are conflicts for file

# result.successful

Successfully merged file

