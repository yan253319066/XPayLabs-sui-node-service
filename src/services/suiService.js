import { Transaction } from '@mysten/sui/transactions'
import { getGraphQLClient, withRateLimit } from './suiClientProvider.js'

/**
 * 获取账户余额
 * @param {string} address - 账户地址
 * @param {string} coinType - 代币类型，默认SUI
 * @param {string} network - 网络类型
 * @returns {Promise<number>} - 余额
 */
export async function getBalance(address, coinType, network = 'testnet') {
  return withRateLimit(async () => {
    const result = await getGraphQLClient(network).getBalance({
      owner: address,
      coinType: coinType || '0x2::sui::SUI',
    })
    return Number.parseInt(result.balance.balance)
  }, network)
}

/**
 * 获取地址拥有的所有代币（自动分页）
 * @param {string} address - 账户地址
 * @param {string} network - 网络类型
 * @returns {Promise<{data: Array, hasNextPage: boolean, cursor: string|null}>} - 代币列表
 */
export async function getAllCoins(address, network = 'testnet') {
  return withRateLimit(async () => {
    const allCoins = []
    let cursor = null
    let hasNextPage = true
    while (hasNextPage) {
      const page = await getGraphQLClient(network).listCoins({
        owner: address,
        cursor,
      })
      allCoins.push(...page.objects)
      hasNextPage = page.hasNextPage
      cursor = page.cursor
    }
    return { data: allCoins, hasNextPage: false, cursor: null }
  }, network)
}

/**
 * 转账 SUI 代币
 * @param {import('@mysten/sui/keypairs/ed25519').Ed25519Keypair} signer - 签名者
 * @param {string} recipient - 接收方地址
 * @param {number} amount - 转账金额(区块链单位)
 * @param {string} network - 网络类型
 * @returns {Promise<{digest: string}>} - 交易结果
 */
export async function transferSUI(signer, recipient, amount, network = 'testnet') {
  try {
    console.log(signer, recipient, amount, network)
    const tx = new Transaction()

    // 从gas中分割代币
    const [coin] = tx.splitCoins(tx.gas, [amount])

    // 将代币转账给接收方
    tx.transferObjects([coin], recipient)

    // 签名并执行交易
    const result = await withRateLimit(async () => {
      return getGraphQLClient(network).signAndExecuteTransaction({
        signer,
        transaction: tx,
      })
    }, network)

    console.log('转账 SUI txid:', result.digest)
    return result
  } catch (error) {
    console.error(`${new Date()} 转账 SUI 时出错:`, error)
    throw error
  }
}

/**
 * 转账自定义代币
 * @param {import('@mysten/sui/keypairs/ed25519').Ed25519Keypair} signer - 签名者
 * @param {string} recipient - 接收方地址
 * @param {number} amount - 转账数量(区块链单位)
 * @param {string} coinType - 代币类型
 * @param {string} network - 网络类型
 * @returns {Promise<{digest: string}>} - 交易结果
 */
export async function transferToken(signer, recipient, amount, coinType, network = 'testnet') {
  try {
    const tx = new Transaction()

    // 获取指定类型的代币
    const coinsResponse = await withRateLimit(async () => {
      return getGraphQLClient(network).listCoins({
        owner: await signer.toSuiAddress(),
        coinType,
      })
    }, network)

    if (coinsResponse.objects.length === 0) {
      throw new Error(`未找到类型为: ${coinType} 的代币`)
    }

    // 使用第一个代币作为主要代币
    const primaryCoin = coinsResponse.objects[0]

    // 如果需要合并更多代币以满足余额需求
    if (coinsResponse.objects.length > 1) {
      const additionalCoins = coinsResponse.objects.slice(1).map(c => tx.object(c.objectId))
      if (additionalCoins.length > 0) {
        tx.mergeCoins(tx.object(primaryCoin.objectId), additionalCoins)
      }
    }

    // 从主要代币中分割出所需金额
    const [coin] = tx.splitCoins(tx.object(primaryCoin.objectId), [amount])

    // 将代币转账给接收方
    tx.transferObjects([coin], recipient)

    // 签名并执行交易
    const result = await withRateLimit(async () => {
      return getGraphQLClient(network).signAndExecuteTransaction({
        signer,
        transaction: tx,
      })
    }, network)

    console.log('转账代币txid:', result.digest)
    return result
  } catch (error) {
    console.error(`${new Date()} 转账代币时出错:`, error)
    throw error
  }
}

/**
 * 将旧版JSON-RPC查询条件映射为GraphQL查询条件
 * @param {object} oldFilter - 旧版查询条件
 * @returns {object|undefined} - GraphQL查询条件
 */
function mapOldFilterToGraphQL(oldFilter) {
  if (!oldFilter || Object.keys(oldFilter).length === 0) return undefined
  const gql = {}
  if (oldFilter.FromAddress) gql.sentAddress = oldFilter.FromAddress
  if (oldFilter.ToAddress) gql.affectedAddress = oldFilter.ToAddress
  if (oldFilter.Checkpoint !== undefined) gql.atCheckpoint = oldFilter.Checkpoint?.toString()
  if (oldFilter.MoveFunction) {
    gql.function = oldFilter.MoveFunction.function
  }
  if (oldFilter.MoveModule) {
    gql.function = oldFilter.MoveModule.module
  }
  if (oldFilter.InputObject) gql.affectedObject = oldFilter.InputObject
  if (oldFilter.ChangedObject) gql.affectedObject = oldFilter.ChangedObject
  return Object.keys(gql).length > 0 ? gql : undefined
}

// GraphQL查询：交易区块列表
const TRANSACTION_BLOCK_QUERY = `
  query TransactionsQuery($after: String, $first: Int, $filter: TransactionFilter) {
    transactions(after: $after, first: $first, filter: $filter) {
      nodes {
        digest
        sender { address }
        effects {
          effectsBcs
          status
          lamportVersion
          gasEffects {
            gasSummary {
              computationCost
              storageCost
              storageRebate
              nonRefundableStorageFee
            }
          }
          objectChanges {
            nodes {
              address
              inputState
              outputState
            }
          }
          dependencies { nodes { digest } }
          effectsDigest
        }
        transactionBcs
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

/**
 * 查询交易区块
 * @param {string} network - 网络类型
 * @param {object} query - 查询条件（必须提供至少一个过滤条件）
 * @param {number} limit - 返回记录数限制
 * @param {string} cursor - 游标，用于分页查询
 * @returns {Promise<{data: Array, hasNextPage: boolean, cursor: string|null}>} - 交易区块列表
 */
export async function queryTransactionBlocks(network = 'testnet', query = {}, limit = 10, cursor = null) {
  try {
    // 验证必须提供至少一个查询条件
    if (!query || Object.keys(query).length === 0) {
      throw new Error('至少需要提供一个查询条件')
    }

    return withRateLimit(async () => {
      const filter = mapOldFilterToGraphQL(query)
      const result = await getGraphQLClient(network).query({
        query: TRANSACTION_BLOCK_QUERY,
        variables: {
          after: cursor,
          first: limit,
          filter,
        },
      })
      return {
        data: result.data?.transactions?.nodes || [],
        hasNextPage: result.data?.transactions?.pageInfo?.hasNextPage || false,
        cursor: result.data?.transactions?.pageInfo?.endCursor || null,
      }
    }, network)
  } catch (error) {
    console.error(`${new Date()} 查询交易区块时出错:`, error.message)
    throw error
  }
}

/**
 * 获取交易区块详情
 * @param {string} digest - 交易摘要
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - 交易区块详情
 */
export async function getTransactionBlock(digest, network = 'testnet') {
  try {
    return withRateLimit(async () => {
      const result = await getGraphQLClient(network).getTransaction({
        digest,
        include: {
          transaction: true,
          effects: true,
          events: true,
          balanceChanges: true,
          objectTypes: true,
        },
      })
      return {
        digest: result.digest,
        effects: result.effects.bcs
          ? { bcs: Array.from(result.effects.bcs), ...result.effects }
          : result.effects,
        events: result.events,
        balanceChanges: result.balanceChanges,
        transaction: result.transaction,
        status: result.status,
      }
    }, network)
  } catch (error) {
    console.error(`${new Date()} 获取交易区块时出错:`, error.message)
    throw error
  }
}

// GraphQL查询：最新检查点序列号
const LATEST_CHECKPOINT_QUERY = `
  query {
    checkpoints(last: 1) {
      nodes {
        sequenceNumber
      }
    }
  }
`

/**
 * 获取最新的检查点序列号
 * @param {string} network - 网络类型
 * @returns {Promise<string>} - 最新检查点序列号
 */
export async function getLatestCheckpointSequenceNumber(network = 'testnet') {
  try {
    return withRateLimit(async () => {
      const result = await getGraphQLClient(network).query({ query: LATEST_CHECKPOINT_QUERY })
      return result.data?.checkpoints?.nodes?.[0]?.sequenceNumber?.toString()
    }, network)
  } catch (error) {
    console.error(`${new Date()} 获取最新检查点序列号时出错:`, error.message)
    throw error
  }
}

// GraphQL查询：单个检查点信息
const CHECKPOINT_QUERY = `
  query CheckpointById($sequenceNumber: UInt53, $digest: String) {
    checkpoint(sequenceNumber: $sequenceNumber, digest: $digest) {
      sequenceNumber
      digest
      networkTotalTransactions
      previousCheckpointDigest
      epoch { epochId }
      timestamp
    }
  }
`

/**
 * 获取特定检查点信息
 * @param {string|number} checkpointId - 检查点ID或序列号
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - 检查点信息
 */
export async function getCheckpoint(checkpointId, network = 'testnet') {
  try {
    return withRateLimit(async () => {
      const idStr = checkpointId?.toString() || ''
      const isNumeric = /^\d+$/.test(idStr)
      const variables = isNumeric
        ? { sequenceNumber: parseInt(idStr, 10), digest: null }
        : { sequenceNumber: null, digest: idStr }
      const result = await getGraphQLClient(network).query({
        query: CHECKPOINT_QUERY,
        variables,
      })
      return result.data?.checkpoint
    }, network)
  } catch (error) {
    console.error(`${new Date()} 获取检查点时出错:`, error.message)
    throw error
  }
}

// GraphQL查询：检查点列表
const CHECKPOINTS_QUERY = `
  query CheckpointsList($after: String, $first: Int, $before: String, $last: Int) {
    checkpoints(after: $after, first: $first, before: $before, last: $last) {
      nodes {
        sequenceNumber
        digest
        networkTotalTransactions
        timestamp
        epoch { epochId }
      }
      pageInfo {
        hasNextPage
        endCursor
        hasPreviousPage
        startCursor
      }
    }
  }
`

/**
 * 获取检查点列表
 * @param {object} options - 查询选项
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - 检查点列表
 */
export async function getCheckpoints(options = {}, network = 'testnet') {
  try {
    return withRateLimit(async () => {
      const descending = options.descendingOrder !== false
      const variables = descending
        ? { before: options.cursor || null, last: options.limit || 10 }
        : { after: options.cursor || null, first: options.limit || 10 }
      const result = await getGraphQLClient(network).query({
        query: CHECKPOINTS_QUERY,
        variables,
      })
      return {
        data: result.data?.checkpoints?.nodes || [],
        hasNextPage: result.data?.checkpoints?.pageInfo?.hasPreviousPage || false,
        cursor: result.data?.checkpoints?.pageInfo?.startCursor || null,
      }
    }, network)
  } catch (error) {
    console.error(`${new Date()} 获取检查点列表时出错:`, error.message)
    throw error
  }
}

/**
 * 预估SUI代币转账的Gas费用
 * @param {string} sender - 发送方地址
 * @param {string} recipient - 接收方地址
 * @param {number} amount - 转账金额(区块链单位)
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - Gas费用估算结果
 */
export async function estimateTransferGasFee(sender, recipient, amount, network = 'testnet') {
  try {
    const tx = new Transaction()

    // 构建转账交易
    const [coin] = tx.splitCoins(tx.gas, [amount])
    tx.transferObjects([coin], recipient)

    // 设置发送方
    tx.setSender(sender)

    // 设置一个合理的Gas预算以确保dry run可以执行
    tx.setGasBudget(50000000)

    // 使用simulateTransaction预估Gas费用
    const dryRunResult = await withRateLimit(async () => {
      return getGraphQLClient(network).simulateTransaction({
        transaction: tx,
        include: { effects: true },
      })
    }, network)

    // 提取Gas费用信息（GraphQL client 返回 { $kind, Transaction/FailedTransaction, commandResults }）
    const txResult = dryRunResult.Transaction ?? dryRunResult.FailedTransaction
    const effects = txResult.effects
    const gasInfo = {
      computationCost: effects.gasUsed.computationCost,
      storageCost: effects.gasUsed.storageCost,
      storageRebate: effects.gasUsed.storageRebate,
      netGasCost: BigInt(effects.gasUsed.computationCost) +
        BigInt(effects.gasUsed.storageCost) -
        BigInt(effects.gasUsed.storageRebate),
      success: effects.status.success === true,
    }

    return gasInfo
  } catch (error) {
    console.error(`${new Date()} 预估Gas费用时出错:`, error.message)
    throw new Error(`预估Gas费用失败: ${error.message}`)
  }
}

/**
 * 预估自定义代币转账的Gas费用
 * @param {string} sender - 发送方地址
 * @param {string} recipient - 接收方地址
 * @param {number} amount - 转账数量(区块链单位)
 * @param {string} coinType - 代币类型
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - Gas费用估算结果
 */
export async function estimateTokenTransferGasFee(sender, recipient, amount, coinType, network = 'testnet') {
  try {
    const tx = new Transaction()

    // 对于SUI代币，使用gas coin进行转账
    if (coinType === '0x2::sui::SUI') {
      const [coin] = tx.splitCoins(tx.gas, [amount])
      tx.transferObjects([coin], recipient)
    } else {
      // 获取指定类型的代币
      const coinsResponse = await withRateLimit(async () => {
        return getGraphQLClient(network).listCoins({ owner: sender, coinType })
      }, network)

      if (coinsResponse.objects.length === 0) {
        throw new Error(`未找到类型为: ${coinType} 的代币`)
      }

      // 使用第一个代币作为主要代币
      const primaryCoin = coinsResponse.objects[0]

      // 如果需要合并更多代币以满足余额需求
      if (coinsResponse.objects.length > 1) {
        const additionalCoins = coinsResponse.objects.slice(1).map(c => tx.object(c.objectId))
        if (additionalCoins.length > 0) {
          tx.mergeCoins(tx.object(primaryCoin.objectId), additionalCoins)
        }
      }

      // 从主要代币中分割出所需金额
      const [coin] = tx.splitCoins(tx.object(primaryCoin.objectId), [amount])

      // 将代币转账给接收方
      tx.transferObjects([coin], recipient)
    }

    // 设置发送方
    tx.setSender(sender)

    // 设置一个合理的Gas预算以确保dry run可以执行
    tx.setGasBudget(50000000)

    // 使用simulateTransaction预估Gas费用
    const dryRunResult = await withRateLimit(async () => {
      return getGraphQLClient(network).simulateTransaction({
        transaction: tx,
        include: { effects: true },
      })
    }, network)

    // 提取Gas费用信息（GraphQL client 返回 { $kind, Transaction/FailedTransaction, commandResults }）
    const txResult = dryRunResult.Transaction ?? dryRunResult.FailedTransaction
    const effects = txResult.effects

    const rawComputation = BigInt(effects.gasUsed.computationCost)
    const rawStorage = BigInt(effects.gasUsed.storageCost)
    const rawRebate = BigInt(effects.gasUsed.storageRebate)
    const netGas = rawComputation + rawStorage - rawRebate

    const gasInfo = {
      computationCost: effects.gasUsed.computationCost,
      storageCost: effects.gasUsed.storageCost,
      storageRebate: effects.gasUsed.storageRebate,
      netGasCost: netGas > 0n ? netGas.toString() : effects.gasUsed.computationCost,
      success: effects.status.success === true,
    }

    return gasInfo
  } catch (error) {
    console.error(`${new Date()} 预估代币转账Gas费用时出错:`, error.message)
    throw new Error(`预估代币转账Gas费用失败: ${error.message}`)
  }
}

// 为SUI转账提供一个更语义化的别名
export const estimateSuiTransferGasFee = (sender, recipient, amount, network) =>
  estimateTokenTransferGasFee(sender, recipient, amount, '0x2::sui::SUI', network)
