import { load, dump } from 'js-yaml'
import type { Plugin } from 'vite'

/**
 * _config.yaml 环境变量注入：字符串值中的 ${VAR} 占位符在构建期从环境变量取值。
 * 变量来源为 loadEnv(mode, root, '')（合并 .env* 文件与 process.env，后者优先），
 * 故 Vercel / EdgeOne Pages 等平台控制台配置的变量与本地 .env.local 均可生效。
 *
 * - 整串占位（如 `level: ${SITE_LEVEL}`）：替换后做标量解析保类型（90 → number、true → boolean）
 * - 内联占位（如 `url: 'https://${DOMAIN}'`）：纯字符串替换
 * - 变量未设置：替换为空串并记入 missing（调用方决定是否告警）
 */

const INLINE_PLACEHOLDER = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g
const FULL_PLACEHOLDER = /^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$/

export interface SubstituteEnvResult<T> {
  value: T
  /** 被引用但未设置的环境变量名（对应位置已替换为空串） */
  missing: string[]
}

/** 整串占位的标量解析：仅接受 number / boolean，其余一律按原字符串处理（避免 Date 等意外类型） */
function parseScalar(raw: string): unknown {
  try {
    const parsed: unknown = load(raw)
    if (typeof parsed === 'number' || typeof parsed === 'boolean') return parsed
  } catch {
    /* 非合法 YAML 标量，按原字符串处理 */
  }
  return raw
}

function substituteString(str: string, env: Record<string, string | undefined>, missing: string[]): unknown {
  const full = str.match(FULL_PLACEHOLDER)
  if (full) {
    const raw = env[full[1]]
    if (raw === undefined) {
      missing.push(full[1])
      return ''
    }
    return parseScalar(raw)
  }
  return str.replace(INLINE_PLACEHOLDER, (_, name: string) => {
    const raw = env[name]
    if (raw === undefined) {
      missing.push(name)
      return ''
    }
    return raw
  })
}

function walk(value: unknown, env: Record<string, string | undefined>, missing: string[]): unknown {
  if (typeof value === 'string') return substituteString(value, env, missing)
  if (Array.isArray(value)) return value.map((item) => walk(item, env, missing))
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      result[key] = walk(item, env, missing)
    }
    return result
  }
  return value
}

/** 递归替换配置对象中所有字符串值的 ${VAR} 占位符（不修改入参） */
export function substituteEnv<T>(value: T, env: Record<string, string | undefined>): SubstituteEnvResult<T> {
  const missing: string[] = []
  return { value: walk(value, env, missing) as T, missing }
}

/**
 * 运行时配置注入插件：enforce 'pre' 使本 transform 先于 @rollup/plugin-yaml 执行，
 * 占位符替换后重新序列化为 YAML 交还其解析，保证打进 bundle 的运行时配置与构建期读取一致。
 * （重序列化会丢失注释，仅影响构建产物，无运行时影响）
 */
export function configEnvSubstitutePlugin(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'vite-plugin-config-env-substitute',
    enforce: 'pre',
    transform(code, id) {
      const filePath = id.split('?')[0].replace(/\\/g, '/')
      if (!filePath.endsWith('/_config.yaml')) return null
      const { value } = substituteEnv(load(code), env)
      return dump(value)
    }
  }
}
