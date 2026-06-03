/**
 * SUI GraphQL 客户端提供者
 *
 * 职责：
 * 1. 按网络类型管理 SuiGraphQLClient 单例
 * 2. 提供限流包装器 withRateLimit()（令牌桶 + 429/5xx 指数退避重试）
 */

import { SuiGraphQLClient } from '@mysten/sui/graphql'
import { getRateLimiter } from '../utils/rateLimiter.js'

// 各网络对应的 GraphQL 端点（优先读取环境变量，否则使用默认公共端点）
const GRAPHQL_URLS = {
  mainnet: process.env.MAINNET_GRAPHQL_URL || 'https://graphql.mainnet.sui.io/graphql',
  testnet: process.env.TESTNET_GRAPHQL_URL || 'https://graphql.testnet.sui.io/graphql',
  devnet: process.env.DEVNET_GRAPHQL_URL || 'https://graphql.devnet.sui.io/graphql',
  localnet: process.env.LOCALNET_GRAPHQL_URL || 'http://127.0.0.1:9125/graphql',
}

// 客户端缓存（按网络）
const clients = {}

/**
 * 获取指定网络的 SuiGraphQLClient 单例
 * @param {string} network - 网络类型 (mainnet/testnet/devnet/localnet)
 * @returns {SuiGraphQLClient} - GraphQL 客户端实例
 */
export function getGraphQLClient(network = 'testnet') {
  const key = network || 'testnet'
  if (!clients[key]) {
    const url = GRAPHQL_URLS[key]
    if (!url) throw new Error(`不支持的网络类型: ${key}`)
    clients[key] = new SuiGraphQLClient({
      url,
      network: key,
    })
  }
  return clients[key]
}

/**
 * 延时函数
 * @param {number} ms - 毫秒
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 限流执行异步函数
 *
 * 在调用函数前先消耗令牌桶令牌，如果请求遇到 429 或 5xx 错误，
 * 自动以指数退避策略重试（最多3次）。
 *
 * @param {Function} fn - 要执行的异步函数
 * @param {string} context - 限流器上下文名称
 * @returns {Promise<any>} - 函数执行结果
 */
export async function withRateLimit(fn, context = 'default') {
  const limiter = getRateLimiter(context)
  await limiter.waitForToken()
  const maxRetries = 3
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('rate limit')
      const is5xx = err?.status >= 500 && err?.status < 600
      if ((is429 || is5xx) && attempt < maxRetries - 1) {
        const delay = Math.min(1000 * 2 ** attempt + Math.random() * 1000, 15000)
        console.warn(`[限流] 第 ${attempt + 1} 次尝试失败，${Math.round(delay)}ms 后重试: ${err.message}`)
        await sleep(delay)
        continue
      }
      throw err
    }
  }
}
