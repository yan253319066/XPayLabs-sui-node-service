import express from 'express';
import { createSignerFromEncryptedKey, clearSignerSensitiveData } from '../services/signerService.js';
import { getBalance, transferSUI, transferToken, queryTransactionBlocks, getTransactionBlock, getLatestCheckpointSequenceNumber, getCheckpoint, getCheckpoints, estimateTokenTransferGasFee, estimateSuiTransferGasFee } from '../services/suiService.js';

const router = express.Router();

// 健康检查端点
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 获取余额
router.get('/balance/:address', async (req, res) => {
    try {
        const { address } = req.params;
        const { coinType, network } = req.query; // 从查询参数获取网络类型
        const balance = await getBalance(address, coinType, network);
        res.json({ address, balance });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 查询交易区块
router.get('/transaction-blocks', async (req, res) => {
    try {
        const { network, limit, cursor, ...query } = req.query;

        // 必须提供查询条件
        if (Object.keys(query).length === 0) {
            return res.status(400).json({ error: '至少需要提供一个查询条件' });
        }

        const result = await queryTransactionBlocks(network, query, parseInt(limit) || 10, cursor);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取交易区块详情
router.get('/transaction-block/:digest', async (req, res) => {
    try {
        const { digest } = req.params;
        const { network } = req.query;

        const result = await getTransactionBlock(digest, network);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取最新的检查点序列号
router.get('/checkpoint/latest', async (req, res) => {
    try {
        const { network } = req.query;
        const result = await getLatestCheckpointSequenceNumber(network);
        res.json({ sequenceNumber: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取特定检查点信息
router.get('/checkpoint/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { network } = req.query;

        const result = await getCheckpoint(id, network);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取检查点列表
router.get('/checkpoints', async (req, res) => {
    try {
        const { network, limit, cursor, descendingOrder } = req.query;

        const options = {
            limit: parseInt(limit) || 10,
            cursor: cursor || null,
            descendingOrder: descendingOrder === 'false' ? false : true
        };

        const result = await getCheckpoints(options, network);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 预估SUI转账Gas费用
router.post('/estimate-transfer-gas-fee', async (req, res) => {
    try {
        const { sender, recipient, amount, network } = req.body;

        if (!sender || !recipient || !amount) {
            return res.status(400).json({ error: '缺少必要参数: sender, recipient, amount' });
        }

        const result = await estimateSuiTransferGasFee(sender, recipient, amount, network);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 预估代币转账Gas费用
router.post('/estimate-token-transfer-gas-fee', async (req, res) => {
    try {
        const { sender, recipient, amount, coinType, network } = req.body;

        if (!sender || !recipient || !amount || !coinType) {
            return res.status(400).json({ error: '缺少必要参数: sender, recipient, amount, coinType' });
        }
        const result = await estimateTokenTransferGasFee(sender, recipient, amount, coinType, network);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 转账 SUI (接收加密的私钥)
router.post('/transfer-sui-with-key', async (req, res) => {
    let signer = null;
    try {
        const { encryptedPrivateKey, recipient, amount, network } = req.body;

        if (!encryptedPrivateKey || !recipient || !amount) {
            return res.status(400).json({ error: '缺少必要参数: encryptedPrivateKey, recipient, amount' });
        }

        // 从加密的私钥创建签名者
        signer = createSignerFromEncryptedKey(encryptedPrivateKey);
        const result = await transferSUI(signer, recipient, amount, network);

        res.json({
            success: true,
            digest: result.digest,
            txid: result.digest
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        // 确保在任何情况下都清除签名者的敏感数据
        if (signer) {
            clearSignerSensitiveData(signer);
        }
    }
});

// 转账自定义代币 (接收加密的私钥)
router.post('/transfer-token-with-key', async (req, res) => {
    let signer = null;
    try {
        const { encryptedPrivateKey, recipient, amount, coinType, network } = req.body;
        if (!encryptedPrivateKey || !recipient || !amount || !coinType) {
            return res.status(400).json({ error: '缺少必要参数: encryptedPrivateKey, recipient, amount, coinType' });
        }

        // 从加密的私钥创建签名者
        signer = createSignerFromEncryptedKey(encryptedPrivateKey);
        const result = await transferToken(signer, recipient, amount, coinType, network);

        res.json({
            success: true,
            digest: result.digest,
            txid: result.digest
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        // 确保在任何情况下都清除签名者的敏感数据
        if (signer) {
            clearSignerSensitiveData(signer);
        }
    }
});

export default router;