#!/usr/bin/env sh
#
# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See License.txt in the project root for license information.
if [ "$VAXX_WSL_DEBUG_INFO" = true ]; then
	set -x
fi

COMMIT="@@COMMIT@@"
APP_NAME="@@APPNAME@@"
QUALITY="@@QUALITY@@"
NAME="@@NAME@@"
VAXX_PATH="$(dirname "$(dirname "$(realpath "$0")")")"
ELECTRON="$VAXX_PATH/$NAME.exe"

IN_WSL=false
if [ -n "$WSL_DISTRO_NAME" ]; then
	# $WSL_DISTRO_NAME is available since WSL builds 18362, also for WSL2
	IN_WSL=true
else
	WSL_BUILD=$(uname -r | sed -E 's/^[0-9.]+-([0-9]+)-Microsoft.*|.*/\1/')
	if [ -n "$WSL_BUILD" ]; then
		if [ "$WSL_BUILD" -ge 17063 ]; then
			# WSLPATH is available since WSL build 17046
			# WSLENV is available since WSL build 17063
			IN_WSL=true
		else
			# If running under older WSL, don't pass cli.js to Electron as
			# environment vars cannot be transferred from WSL to Windows
			# See: https://github.com/microsoft/BashOnWindows/issues/1363
			#      https://github.com/microsoft/BashOnWindows/issues/1494
			"$ELECTRON" "$@"
			exit $?
		fi
	fi
fi
if [ $IN_WSL = true ]; then

	export WSLENV="ELECTRON_RUN_AS_NODE/w:$WSLENV"

	ELECTRON_RUN_AS_NODE=1 "$ELECTRON" >/tmp/remote-wsl-loc.txt 2>/dev/null </dev/null
fi
ELECTRON_RUN_AS_NODE=1 "$ELECTRON" "$@"
exit $?
