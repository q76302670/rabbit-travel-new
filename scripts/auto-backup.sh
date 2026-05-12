#!/bin/bash
# 兔子旅行 - 自动备份到 GitHub
# 每天凌晨 2:00 由 cron 触发

set -e

cd /Users/qy/WeChatProjects/rabbit-travel-new

# 防止 cron 环境中 PATH 不完整
export PATH=/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin:$PATH

# 检查是否是 git 仓库
if [ ! -d .git ]; then
  echo "[备份] 错误: 不是 git 仓库"
  exit 1
fi

# 拉取远程最新变更
git pull origin main --no-rebase 2>/dev/null || true

# 添加所有变更
git add -A

# 检查是否有变更需要提交
if git diff --cached --quiet; then
  echo "[备份] 无变更，跳过提交"
else
  git commit -m "🔄 自动备份 $(date '+%Y-%m-%d %H:%M')"
  echo "[备份] 已提交变更"
fi

# 推送到 GitHub
git push origin main 2>&1

echo "[备份] 完成: $(date '+%Y-%m-%d %H:%M:%S')"
