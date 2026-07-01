#!/usr/bin/env bash
set -Eeuo pipefail

# macOS/Linux 安装脚本。by AI.Coding
# 该脚本安装 Node 版本的 workflow-switcher，不发布 npm、不打包二进制。

REPO_URL="${WORKFLOW_SWITCHER_REPO_URL:-https://github.com/yangquanyun/workflow-switcher/archive/refs/heads/main.tar.gz}"
INSTALL_DIR="${WORKFLOW_SWITCHER_INSTALL_DIR:-$HOME/.workflow-switcher}"
BIN_DIR="${WORKFLOW_SWITCHER_BIN_DIR:-$HOME/.local/bin}"
APP_DIR="$INSTALL_DIR/app"
BIN_PATH="$BIN_DIR/workflow-switcher"
NPM_LOG="$INSTALL_DIR/npm-install.log"

fail() {
  echo "❌ 安装失败"
  echo
  echo "原因"
  echo "  $1"
  echo
  echo "处理方式"
  echo "  $2"
  exit 1
}

unexpected_error() {
  echo "❌ 安装失败"
  echo
  echo "原因"
  echo "  安装过程中出现未预期错误。"
  echo
  echo "处理方式"
  echo "  请检查当前用户是否有权限写入 $INSTALL_DIR 和 $BIN_DIR，然后重新执行安装命令。"
  exit 1
}

trap unexpected_error ERR

bin_dir_in_path() {
  case ":$PATH:" in
    *":$BIN_DIR:"*) return 0 ;;
    *) return 1 ;;
  esac
}

print_success() {
  echo "✅ Workflow Switcher 安装完成"
  echo
  echo "安装位置"
  echo "  应用目录: $APP_DIR"
  echo "  命令入口: $BIN_PATH"
  echo

  if bin_dir_in_path; then
    echo "✅ 命令已可用"
    echo
    echo "下一步"
    echo "  workflow-switcher setup"
  else
    local profile="$HOME/.zshrc"
    if [ "${SHELL:-}" != "${SHELL%bash}" ]; then
      profile="$HOME/.bashrc"
    fi
    echo "⚠️ 命令暂时不可用"
    echo
    echo "原因"
    echo "  $BIN_DIR 不在当前 PATH 中"
    echo
    echo "处理方式"
    echo "  echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> $profile"
    echo "  source $profile"
    echo
    echo "或者直接执行"
    echo "  $BIN_PATH setup"
  fi

  echo
  echo "常用命令"
  echo "  workflow-switcher          打开交互菜单"
  echo "  workflow-switcher use      选择并切换工作流"
  echo "  workflow-switcher doctor   检查环境和软链接权限"
}

if ! command -v node >/dev/null 2>&1; then
  fail "未检测到 Node.js。" "请先安装 Node.js 20.17 或更高的 LTS 版本，推荐使用 Node.js 22 LTS。"
fi

NODE_VERSION="$(node -p "process.versions.node")"
if ! node -e "const [major,minor,patch]=process.versions.node.split('.').map(Number); const supported=(major===20 && minor>=17) || (major===22 && minor>=13) || (major===23 && (minor>5 || (minor===5 && patch>=0))) || major>23; process.exit(supported ? 0 : 1)"; then
  fail "当前 Node.js 版本为 $NODE_VERSION，版本过低。" "请先升级 Node.js，然后重新执行安装命令。"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
curl -fsSL "$REPO_URL" -o "$TMP_DIR/workflow-switcher.tar.gz" || fail "下载安装包失败。" "请检查网络是否可以访问 GitHub，然后重新执行安装命令。"
tar -xzf "$TMP_DIR/workflow-switcher.tar.gz" -C "$TMP_DIR" || fail "安装包解压失败。" "请重新执行安装命令；如果仍失败，请检查系统 tar 命令是否可用。"
ENTRY_FILE="$(find "$TMP_DIR" -path "*/bin/workflow-switcher.mjs" -type f | head -n 1)"
if [ -z "$ENTRY_FILE" ]; then
  fail "安装包结构无效，未找到 bin/workflow-switcher.mjs。" "请确认安装命令使用的是 workflow-switcher 仓库 main 分支。"
fi
SRC_DIR="$(dirname "$(dirname "$ENTRY_FILE")")"

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
cp -R "$SRC_DIR"/. "$APP_DIR"
chmod +x "$APP_DIR/bin/workflow-switcher.mjs"

# 静默安装运行时依赖，避免把 npm 审计和 funding 信息暴露给普通用户。
if ! (cd "$APP_DIR" && npm install --omit=dev --silent >"$NPM_LOG" 2>&1); then
  fail "运行依赖安装失败。" "请检查网络是否可以访问 npm registry；详细日志: $NPM_LOG"
fi
rm -f "$NPM_LOG"

cat > "$BIN_PATH" <<EOF
#!/usr/bin/env bash
exec node "$APP_DIR/bin/workflow-switcher.mjs" "\$@"
EOF
chmod +x "$BIN_PATH"

print_success
