#!/bin/bash

DEV_TAG=$1
PACKAGE="sf-git-merge-driver"

npm view "${PACKAGE}" versions --json | jq -r '.[]' | grep "\\-${DEV_TAG}\\." | xargs -I {} npm deprecate "${PACKAGE}@{}" "Deprecated dev version"
npm dist-tag rm "${PACKAGE}" "${DEV_TAG}"