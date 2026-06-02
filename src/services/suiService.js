import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { MIST_PER_SUI } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';

/**
 * 创建SUI客户端
 * @param {string} network - 网络类型 (testnet/mainnet/devnet/localnet)
 * @returns {SuiClient} - SUI客户端实例
 */
function createSuiClient(network) {
    return new SuiClient({ url: getFullnodeUrl(network) });
}

/**
 * 获取账户余额
 * @param {string} address - 账户地址
 * @param {string} coinType - 代币类型
 * @param {string} network - 网络类型
 * @returns {Promise<number>} - 余额
 */
export async function getBalance(address, coinType, network = 'testnet') {
    const suiClient = createSuiClient(network);
    const balance = await suiClient.getBalance({
        owner: address,
        coinType: coinType || '0x2::sui::SUI',
    });
    return Number.parseInt(balance.totalBalance);
}

/**
 * 获取地址拥有的所有代币
 * @param {string} address - 账户地址
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - 代币信息
 */
export async function getAllCoins(address, network = 'testnet') {
    const suiClient = createSuiClient(network);
    return await suiClient.getAllCoins({
        owner: address,
    });
}

/**
 * 转账 SUI 代币
 * @param {Ed25519Keypair} signer - 签名者
 * @param {string} recipient - 接收方地址
 * @param {number} amount - 转账金额(区块链单位)
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - 交易结果
 */
export async function transferSUI(signer, recipient, amount, network = 'testnet') {
    try {
        console.log(signer, recipient, amount, network);
        const suiClient = createSuiClient(network);
        const tx = new Transaction();

        // 从gas中分割代币
        const [coin] = tx.splitCoins(tx.gas, [amount]);

        // 将代币转账给接收方
        tx.transferObjects([coin], recipient);

        // 签名并执行交易
        const result = await suiClient.signAndExecuteTransaction({
            signer: signer,
            transaction: tx,
        });

        console.log('转账 SUI txid:', result.digest);
        return result;
    } catch (error) {
        console.error(`${new Date()} 转账 SUI 时出错:`, error);
        throw error;
    }

}

/**
 * 转账自定义代币
 * @param {Ed25519Keypair} signer - 签名者
 * @param {string} recipient - 接收方地址
 * @param {number} amount - 转账数量(区块链单位)
 * @param {string} coinType - 代币类型
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - 交易结果
 */
export async function transferToken(signer, recipient, amount, coinType, network = 'testnet') {
    try {
        const suiClient = createSuiClient(network);
        const tx = new Transaction();

        // 获取指定类型的代币
        const coins = await suiClient.getCoins({
            owner: await signer.toSuiAddress(),
            coinType: coinType,
        });

        if (coins.data.length === 0) {
            throw new Error(`未找到类型为: ${coinType} 的代币`);
        }

        // 使用第一个代币作为主要代币
        const primaryCoin = coins.data[0];

        // 如果需要合并更多代币以满足余额需求
        if (coins.data.length > 1) {
            // 将额外的代币合并到主要代币中
            const additionalCoins = coins.data.slice(1).map(coin => tx.object(coin.coinObjectId));
            if (additionalCoins.length > 0) {
                tx.mergeCoins(tx.object(primaryCoin.coinObjectId), additionalCoins);
            }
        }

        // 从主要代币中分割出所需金额
        const [coin] = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [amount]);

        // 将代币转账给接收方
        tx.transferObjects([coin], recipient);

        // 签名并执行交易
        const result = await suiClient.signAndExecuteTransaction({
            signer: signer,
            transaction: tx,
        });

        console.log('转账代币txid:', result.digest);
        return result;
    } catch (error) {
        console.error(`${new Date()} 转账代币时出错:`, error);
        throw error;
    }

}

/**
 * 查询交易区块
 * @param {string} network - 网络类型
 * @param {object} query - 查询条件（必须提供至少一个过滤条件）
 * @param {number} limit - 返回记录数限制
 * @param {string} cursor - 游标，用于分页查询
 * @returns {Promise<object>} - 交易区块列表
 * 
 * query参数示例：
 * 1. 查询来自特定地址的交易：
 *    { FromAddress: "0x123..." }
 * 2. 查询发送到特定地址的交易：
 *    { ToAddress: "0x456..." }
 * 3. 查询特定类型的交易：
 *    { Checkpoint: checkpointSequenceNumber }
 * 4. 查询移动模块相关的交易：
 *    { MoveModule: { package: "0x...", module: "moduleName" } }
 * 5. 查询移动函数相关的交易：
 *    { MoveFunction: { package: "0x...", module: "moduleName", function: "functionName" } }
 */
export async function queryTransactionBlocks(network = 'testnet', query = {}, limit = 10, cursor = null) {
    try {
        const suiClient = createSuiClient(network);

        // 验证必须提供至少一个查询条件
        if (!query || Object.keys(query).length === 0) {
            throw new Error('至少需要提供一个查询条件');
        }

        const response = await suiClient.queryTransactionBlocks({
            filter: query,
            options: {
                showInput: true,
                showEffects: true,
                showEvents: true,
                showBalanceChanges: true,
                showObjectChanges: true,
            },
            limit: limit,
            cursor: cursor
        });

        return response;
    } catch (error) {
        console.error(`${new Date()} 查询交易区块时出错:`, error.message);
        // console.error(`${new Date()} 查询交易区块时出错:`, error);
        throw error;
    }
}

/**
 * 获取交易区块详情
 * @param {string} digest - 交易摘要
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - 交易区块详情
 */
export async function getTransactionBlock(digest, network = 'testnet') {
    const suiClient = createSuiClient(network);

    const response = await suiClient.getTransactionBlock({
        digest: digest,
        options: {
            showInput: true,
            showEffects: true,
            showEvents: true,
            showObjectChanges: true,
            showBalanceChanges: true,
        }
    });

    return response;
}

/**
 * 获取最新的检查点序列号
 * @param {string} network - 网络类型
 * @returns {Promise<string>} - 最新检查点序列号
 */
export async function getLatestCheckpointSequenceNumber(network = 'testnet') {
    try {
        const suiClient = createSuiClient(network);
        return await suiClient.getLatestCheckpointSequenceNumber();
    } catch (error) {
        console.error(`${new Date()} 获取最新检查点序列号时出错:`, error.message);
        throw error;
    }
}

/**
 * 获取特定检查点信息
 * @param {string|number} checkpointId - 检查点ID或序列号
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - 检查点信息
 */
export async function getCheckpoint(checkpointId, network = 'testnet') {
    const suiClient = createSuiClient(network);

    const response = await suiClient.getCheckpoint({ id: checkpointId.toString() });
    return response;
}

/**
 * 获取检查点列表
 * @param {object} options - 查询选项
 * @param {string} network - 网络类型
 * @returns {Promise<object>} - 检查点列表
 */
export async function getCheckpoints(options = {}, network = 'testnet') {
    const suiClient = createSuiClient(network);

    const queryParams = {
        descendingOrder: options.descendingOrder || true,
        limit: options.limit || 10,
        cursor: options.cursor || null
    };

    const response = await suiClient.getCheckpoints(queryParams);
    return response;
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
        const suiClient = createSuiClient(network);
        const tx = new Transaction();

        // 构建转账交易
        const [coin] = tx.splitCoins(tx.gas, [amount]);
        tx.transferObjects([coin], recipient);

        // 设置发送方
        tx.setSender(sender);

        // 设置一个合理的Gas预算以确保dry run可以执行
        // 使用较低的预算，避免余额不足的问题
        tx.setGasBudget(50000000); // 0.05 SUI作为预算

        // 使用dryRunTransactionBlock预估Gas费用
        const dryRunResult = await suiClient.dryRunTransactionBlock({
            transactionBlock: await tx.build({ client: suiClient })
        });

        // 提取Gas费用信息
        const gasInfo = {
            computationCost: dryRunResult.effects.gasUsed.computationCost,
            storageCost: dryRunResult.effects.gasUsed.storageCost,
            storageRebate: dryRunResult.effects.gasUsed.storageRebate,
            netGasCost: BigInt(dryRunResult.effects.gasUsed.computationCost) +
                BigInt(dryRunResult.effects.gasUsed.storageCost) -
                BigInt(dryRunResult.effects.gasUsed.storageRebate),
            success: dryRunResult.effects.status.status === 'success'
        };

        return gasInfo;
    } catch (error) {
        console.error(`${new Date()} 预估Gas费用时出错:`, error.message);
        throw new Error(`预估Gas费用失败: ${error.message}`);
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
        const suiClient = createSuiClient(network);
        const tx = new Transaction();

        // 对于SUI代币，使用gas coin进行转账
        if (coinType === '0x2::sui::SUI') {
            // 构建转账交易
            const [coin] = tx.splitCoins(tx.gas, [amount]);
            tx.transferObjects([coin], recipient);
        } else {
            // 获取指定类型的代币
            const coins = await suiClient.getCoins({
                owner: sender,
                coinType: coinType,
            });

            if (coins.data.length === 0) {
                throw new Error(`未找到类型为: ${coinType} 的代币`);
            }

            // 使用第一个代币作为主要代币
            const primaryCoin = coins.data[0];

            // 如果需要合并更多代币以满足余额需求
            if (coins.data.length > 1) {
                // 将额外的代币合并到主要代币中
                const additionalCoins = coins.data.slice(1).map(coin => tx.object(coin.coinObjectId));
                if (additionalCoins.length > 0) {
                    tx.mergeCoins(tx.object(primaryCoin.coinObjectId), additionalCoins);
                }
            }

            // 从主要代币中分割出所需金额
            const [coin] = tx.splitCoins(tx.object(primaryCoin.coinObjectId), [amount]);

            // 将代币转账给接收方
            tx.transferObjects([coin], recipient);
        }

        // 设置发送方
        tx.setSender(sender);

        // 设置一个合理的Gas预算以确保dry run可以执行
        // 使用较低的预算，避免余额不足的问题
        tx.setGasBudget(50000000); // 0.05 SUI作为预算

        // 使用dryRunTransactionBlock预估Gas费用
        const dryRunResult = await suiClient.dryRunTransactionBlock({
            transactionBlock: await tx.build({ client: suiClient })
        });

        // 提取Gas费用信息
        const gasInfo = {
            computationCost: dryRunResult.effects.gasUsed.computationCost,
            storageCost: dryRunResult.effects.gasUsed.storageCost,
            storageRebate: dryRunResult.effects.gasUsed.storageRebate,
            // 修正netGasCost计算：用户实际需要支付的费用
            netGasCost: Number(dryRunResult.effects.gasUsed.computationCost) +
                Number(dryRunResult.effects.gasUsed.storageCost) -
                Number(dryRunResult.effects.gasUsed.storageRebate) > 0n ?
                Number(dryRunResult.effects.gasUsed.computationCost) +
                Number(dryRunResult.effects.gasUsed.storageCost) -
                Number(dryRunResult.effects.gasUsed.storageRebate) :
                Number(dryRunResult.effects.gasUsed.computationCost),
            success: dryRunResult.effects.status.status === 'success'
        };

        return gasInfo;
    } catch (error) {
        console.error(`${new Date()} 预估代币转账Gas费用时出错:`, error.message);
        throw new Error(`预估代币转账Gas费用失败: ${error.message}`);
    }
}

// 为SUI转账提供一个更语义化的别名
export const estimateSuiTransferGasFee = (sender, recipient, amount, network) =>
    estimateTokenTransferGasFee(sender, recipient, amount, '0x2::sui::SUI', network);
