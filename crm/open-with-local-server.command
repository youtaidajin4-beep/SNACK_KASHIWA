#!/bin/bash
# Snack CRM をローカル HTTP で開く（日本語パスや file:// の制限を避ける）
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${CRM_PORT:-8765}"

if command -v lsof >/dev/null 2>&1 && lsof -i ":$PORT" >/dev/null 2>&1; then
  echo "ポート ${PORT} は使用中です。使用中の「python3 -m http.server」を止めるか、次のように別ポートで実行してください:"
  echo "  CRM_PORT=8766 open \"$0\""
  exit 1
fi

echo "http://127.0.0.1:${PORT}/crm/ を起動しています…"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

sleep 0.5
URL="http://127.0.0.1:${PORT}/crm/index.html"

if command -v open >/dev/null 2>&1; then
  open "$URL" || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" || true
else
  echo "ブラウザで次を開いてください:"
  echo "  $URL"
fi

echo ""
echo "表示中: $URL"
echo "このターミナルを閉じるとサーバーが止まります（Ctrl+C でも終了）。"
wait "$PID"
