/**
 * 令牌桶限流器
 *
 * 以固定速率向桶中填充令牌，每次请求消耗一个令牌。
 * 当桶为空时请求进入等待队列，直到有可用令牌或超时。
 *
 * 默认配置：每30秒补充80个令牌（对应Sui公共RPC限制100 req/30s，预留缓冲）
 */

// 默认令牌桶容量（最大并发令牌数）
const RATE_LIMIT_TOKENS = 80
// 令牌桶填充窗口（毫秒）
const RATE_LIMIT_WINDOW_MS = 30000

export class TokenBucket {
  /**
   * @param {number} capacity - 桶容量
   * @param {number} fillIntervalMs - 填充间隔（毫秒）
   */
  constructor(capacity = RATE_LIMIT_TOKENS, fillIntervalMs = RATE_LIMIT_WINDOW_MS) {
    this.capacity = capacity
    this.tokens = capacity
    this.fillIntervalMs = fillIntervalMs
    this.lastRefill = Date.now()
    this.queue = []
  }

  /**
   * 补充令牌
   */
  refill() {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    if (elapsed < this.fillIntervalMs) return
    const refillCount = Math.floor(elapsed / this.fillIntervalMs)
    if (refillCount > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + refillCount * this.capacity)
      this.lastRefill = now
    }
  }

  /**
   * 尝试消耗令牌（非阻塞）
   * @param {number} count - 消耗数量
   * @returns {boolean} - 是否成功
   */
  tryConsume(count = 1) {
    this.refill()
    if (this.tokens >= count) {
      this.tokens -= count
      return true
    }
    return false
  }

  /**
   * 等待并消耗令牌（阻塞）
   * @param {number} count - 消耗数量
   * @param {number} timeoutMs - 超时时间（毫秒），0表示无限等待
   * @returns {Promise<void>}
   */
  async waitForToken(count = 1, timeoutMs = 30000) {
    if (this.tryConsume(count)) return
    return new Promise((resolve, reject) => {
      const timer = timeoutMs ? setTimeout(() => reject(new Error('Rate limit timeout')), timeoutMs) : null
      this.queue.push(() => {
        if (timer) clearTimeout(timer)
        this.tokens -= count
        resolve()
      })
      this.processQueue()
    })
  }

  /**
   * 处理等待队列
   */
  processQueue() {
    if (this.queue.length === 0) return
    this.refill()
    while (this.queue.length > 0 && this.tokens > 0) {
      const next = this.queue.shift()
      next()
    }
  }
}

const buckets = new Map()

/**
 * 获取或创建指定名称的令牌桶
 * @param {string} name - 限流器名称
 * @param {number} [capacity] - 桶容量
 * @param {number} [fillIntervalMs] - 填充间隔
 * @returns {TokenBucket} - 令牌桶实例
 */
export function getRateLimiter(name = 'default', capacity, fillIntervalMs) {
  if (!buckets.has(name)) {
    buckets.set(name, new TokenBucket(capacity, fillIntervalMs))
  }
  return buckets.get(name)
}
