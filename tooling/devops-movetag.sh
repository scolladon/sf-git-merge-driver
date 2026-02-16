#!/bin/bash

VERSION=$1
TAG=$2
OTP=$3
PACKAGE="sf-git-merge-driver"

npm dist-tag add "${PACKAGE}@${VERSION}" "${TAG}" --otp="${OTP}"