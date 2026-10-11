#!/bin/zsh
set -e
cd "$(dirname "$0")"
for demo_port in 4174 5173; do
  demo_page=$(curl --silent --max-time 2 "http://127.0.0.1:$demo_port/" 2>/dev/null || true)
  if [[ "$demo_page" == *'<title>Дом в вашем ритме — Smart House</title>'* ]]; then
    open "http://127.0.0.1:$demo_port"
    exit 0
  fi
done
if ! command -v npm >/dev/null 2>&1; then
  print 'Нужен Node.js 22.12+ или 24+. После установки снова откройте Start.command.'
  read '?Нажмите Enter для выхода'
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
node scripts/dev.mjs &
demo_pid=$!
trap 'kill "$demo_pid" 2>/dev/null || true' EXIT INT TERM
for demo_attempt in {1..40}; do
  if ! kill -0 "$demo_pid" 2>/dev/null; then
    wait "$demo_pid"
    exit 1
  fi
  demo_page=$(curl --silent --max-time 1 'http://127.0.0.1:5173/' 2>/dev/null || true)
  if [[ "$demo_page" == *'<title>Дом в вашем ритме — Smart House</title>'* ]]; then
    open 'http://127.0.0.1:5173'
    break
  fi
  sleep 0.25
done
wait "$demo_pid"
