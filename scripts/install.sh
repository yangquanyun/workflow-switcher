#!/usr/bin/env bash
set -euo pipefail

# macOS/Linux 安装脚本。by AI.Coding
# 该脚本安装 Node 版本的 workflow-switcher，不发布 npm、不打包二进制。

REPO_URL="${WORKFLOW_SWITCHER_REPO_URL:-https://github.com/yangquanyun/workflow-switcher/archive/refs/heads/main.tar.gz}"
INSTALL_DIR="${WORKFLOW_SWITCHER_INSTALL_DIR:-$HOME/.workflow-switcher}"
BIN_DIR="${WORKFLOW_SWITCHER_BIN_DIR:-$HOME/.local/bin}"

if ! command -v node >/dev/null 2>&1; then
  echo "未检测到 Node.js，请先安装 Node.js 20.17+、22.13+ 或 23.5+。"
  exit 1
fi

NODE_VERSION="$(node -p "process.versions.node")"
if ! node -e "const [major,minor,patch]=process.versions.node.split('.').map(Number); const supported=(major===20 && minor>=17) || (major===22 && minor>=13) || (major===23 && (minor>5 || (minor===5 && patch>=0))) || major>23; process.exit(supported ? 0 : 1)"; then
  echo "当前 Node.js 版本为 $NODE_VERSION，workflow-switcher 需要 Node.js 20.17+、22.13+ 或 23.5+。"
  echo "处理方式: 请先升级 Node.js，然后重新执行安装命令。"
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
curl -fsSL "$REPO_URL" -o "$TMP_DIR/workflow-switcher.tar.gz"
tar -xzf "$TMP_DIR/workflow-switcher.tar.gz" -C "$TMP_DIR"
ENTRY_FILE="$(find "$TMP_DIR" -path "*/bin/workflow-switcher.mjs" -type f | head -n 1)"
if [ -z "$ENTRY_FILE" ]; then
  echo "安装包结构无效：未找到 bin/workflow-switcher.mjs"
  exit 1
fi
SRC_DIR="$(dirname "$(dirname "$ENTRY_FILE")")"

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
echo "下一步请执行：$BIN_DIR/workflow-switcher setup"
