#!/bin/bash
# Deploy Pulse Compiler REST API using uvicorn
# Usage: ./deploy_pulse_api.sh [host] [port]

HOST=${1:-0.0.0.0}
PORT=${2:-8000}

cd "$(dirname "$0")/../pulse/dsl"

# Install dependencies if needed
if [ -f requirements.txt ]; then
    pip install -r requirements.txt
else
    pip install fastapi uvicorn antlr4-python3-runtime
fi

# Run the API
exec uvicorn pulse_api:app --host $HOST --port $PORT
