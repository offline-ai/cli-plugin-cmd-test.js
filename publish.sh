#!/usr/bin/env bash

set -eo pipefail

function pnpm_release() {
  folder=$1
  pushd $folder
  git ci -am 'chore: update' || true
  pnpm release
  git push --follow-tags origin main
  pnpm publish --no-git-checks --access public
  popd
}


pnpm_release ../cli-plugin-cmd-test

# 依赖 ai-tool-agent detect-text-language
pnpm_release ../ai-agent

