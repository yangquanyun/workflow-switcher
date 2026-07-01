#!/usr/bin/env bash
set -euo pipefail

# macOS/Linux 安装脚本。by AI.Coding
# 该脚本安装 Node 版本的 workflow-switcher，不发布 npm、不打包二进制。

REPO_URL="${WORKFLOW_SWITCHER_REPO_URL:-https://github.com/yangquanyun/workflow-switcher-plugin/archive/refs/heads/main.tar.gz}"
INSTALL_DIR="${WORKFLOW_SWITCHER_INSTALL_DIR:-$HOME/.workflow-switcher}"
BIN_DIR="${WORKFLOW_SWITCHER_BIN_DIR:-$HOME/.local/bin}"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js 18 或更高版本。"
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "当前 Node.js 版本过低，请升级到 Node.js 18 或更高版本。"
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
curl -fsSL "$REPO_URL" -o "$TMP_DIR/workflow-switcher.tar.gz"
tar -xzf "$TMP_DIR/workflow-switcher.tar.gz" -C "$TMP_DIR"
SRC_DIR="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"

rm -rf "$INSTALL_DIR/app"
mkdir -p "$INSTALL_DIR/app"
cp -R "$SRC_DIR"/. "$INSTALL_DIR/app"
chmod +x "$INSTALL_DIR/app/bin/workflow-switcher.mjs"

# 安装运行时依赖，当前 CLI 使用 chalk 提供彩色输出。
(cd "$INSTALL_DIR/app" && npm install --omit=dev)

cat > "$BIN_DIR/workflow-switcher" <<EOF
#!/usr/bin/env bash
exec node "$INSTALL_DIR/app/bin/workflow-switcher.mjs" "\$@"
EOF
chmod +x "$BIN_DIR/workflow-switcher"

echo "workflow-switcher 已安装到 $BIN_DIR/workflow-switcher"
echo "如果命令不可用，请把 $BIN_DIR 加入 PATH。"
"$BIN_DIR/workflow-switcher" setup
