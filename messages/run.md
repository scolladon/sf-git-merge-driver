# summary

Runs the merge driver for the specified files.

# description

Runs the merge driver for the specified files, handling the merge conflict resolution using Salesforce-specific merge strategies. This command is typically called automatically by Git when a merge conflict is detected.

# examples

- Run the merge driver for conflicting files:

  <%= config.bin %> <%= command.id %> --ancestor-file=<value> --local-file=<value> --other-file=<value> --output-file=<value>

- Where:
  - ancestor-file is the path to the common ancestor version of the file
  - local-file is the path to our version of the file
  - other-file is the path to their version of the file
  - output-file is the path to the file where the merged content will be written

# flags.ancestor-file.summary

path to the common ancestor version of the file

# flags.local-file.summary

path to our version of the file

# flags.other-file.summary

path to their version of the file

# flags.output-file.summary

path to the file where the merged content will be written

# flags.conflict-marker-size.summary
number of characters to show for conflict markers

# flags.ancestor-conflict-tag.summary
string used to tag ancestor version in conflicts

# flags.local-conflict-tag.summary
string used to tag local version in conflicts

# flags.other-conflict-tag.summary
string used to tag other version in conflicts
