#!/bin/bash
set -e

# Keep container running for docker exec access
# This is the standard pattern for dev containers
exec sleep infinity
