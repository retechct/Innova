#!/usr/bin/env bash
set -euo pipefail

python migrations/bootstrap.py
exec gunicorn app:app
