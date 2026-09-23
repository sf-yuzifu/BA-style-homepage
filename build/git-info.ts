import { execSync } from 'node:child_process'

/**
 * 构建期版本信息：git 提交 hash + 构建时间 + 提交页 URL。
 * 由 vite.config.ts 经 define 注入为 __BUILD_INFO__，供「设置 → 关于」面板展示，
 * 让访客能确认线上部署对应的提交版本。
 *
 * 版本标识锚定「本次构建基于的提交」，不反映构建瞬间的工作区状态：
 * 构建期产物 / 平台元数据 / 未提交改动等短暂脏状态不计入（曾导致产物误带 -dirty
 * 且无法跳转提交页），hash 与提交链接始终对应到 commit 本身。
 */

export interface BuildInfo {
  /** 完整提交 hash（环境变量回退时可能为短 hash）；无法获取时为空串 */
  hash: string
  /** 展示用短 hash（7 位）；无法获取时为 'unknown' */
  shortHash: string
  /** 构建时间 YYYY-MM-DD HH:mm */
  buildTime: string
  /** 对应提交的网页 URL；无法确定仓库时为空串 */
  commitUrl: string
}

const tryExec = (command: string): string | null => {
  try {
    const out = execSync(command, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
    return out.trim() || null
  } catch {
    return null
  }
}

const pad = (n: number): string => String(n).padStart(2, '0')

const formatBuildTime = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`

/** git remote 地址（https / ssh / scp 形式）统一转成 https 仓库主页 */
export function toRepoWebUrl(remote: string): string {
  const scp = remote.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
  if (scp) return `https://${scp[1]}/${scp[2]}`
  const url = remote.replace(/^ssh:\/\/git@/i, 'https://').replace(/\.git$/, '')
  return /^https?:\/\//i.test(url) ? url : ''
}

export function resolveBuildInfo(): BuildInfo {
  // 本地 / CI 克隆仓库直接读 git；无 .git 时回退平台注入的提交环境变量
  const hash =
    tryExec('git rev-parse HEAD') ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.CI_COMMIT_SHA ??
    ''
  const remote = tryExec('git remote get-url origin') ?? ''
  const repoUrl = remote ? toRepoWebUrl(remote) : ''
  const shortHash = hash ? hash.slice(0, 7) : 'unknown'
  const commitUrl = hash && repoUrl ? `${repoUrl}/commit/${hash}` : ''
  return { hash, shortHash, buildTime: formatBuildTime(new Date()), commitUrl }
}
