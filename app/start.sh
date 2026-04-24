#!/bin/bash
# Find the correct node executable and start the server
if command -v node >/dev/null 2>&1; then
    node server.js
elif [ -f "/mnt/c/Program Files/nodejs/node.exe" ]; then
    "/mnt/c/Program Files/nodejs/node.exe" server.js
else
    echo "Node.js not found. Please install Node.js in WSL or Windows."
    exit 1
fi
