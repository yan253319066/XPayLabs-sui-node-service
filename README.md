# SUI 区块链服务 @mysten/sui 2.17.0

这是一个基于Node.js的SUI区块链服务，可以通过REST API从Spring Boot应用安全调用。该服务支持SUI代币和自定义代币转账功能，并提供安全的私钥管理机制。

## 安全架构

1. **私钥存储**：私钥始终存储在Spring Boot应用中，永不存储在Node.js服务中
2. **加密传输**：Spring Boot通过AES加密传输私钥到Node.js服务
3. **临时使用**：Node.js服务解密私钥并执行签名操作后立即丢弃私钥
4. **安全清除**：Node.js服务在签名操作完成后主动清除签名者的敏感数据
5. **多环境支持**：支持开发、测试和生产环境配置

## 安装和运行

1. 安装依赖：
```bash
npm install
```

2. 配置环境：
编辑 `.env.development` 或 `.env.production` 文件，配置加密密钥

3. 启动服务：
```bash
# 开发环境
npm run dev

# 生产环境
npm run prod
```

服务将在 `http://localhost:3001` 上运行

## API 接口

### 健康检查
```
GET /health
```

### 获取余额
```
GET /balance/{address}?network={network}
参数:
- address: SUI地址
- network: 网络类型 (testnet/mainnet/devnet/localnet)
```

### 查询交易区块
```
GET /transaction-blocks?network={network}&limit={limit}&cursor={cursor}&[查询条件]
参数:
- network: 网络类型 (testnet/mainnet/devnet/localnet)
- limit: 返回记录数限制(默认10)
- cursor: 游标，用于分页查询
- 查询条件: 必须提供至少一个查询过滤条件，如 FromAddress, ToAddress 等
```

### 获取交易区块详情
```
GET /transaction-block/{digest}?network={network}
参数:
- digest: 交易摘要
- network: 网络类型 (testnet/mainnet/devnet/localnet)
```

### 获取最新的检查点序列号
```
GET /checkpoint/latest?network={network}
参数:
- network: 网络类型 (testnet/mainnet/devnet/localnet)
```

### 获取特定检查点信息
```
GET /checkpoint/{id}?network={network}
参数:
- id: 检查点ID或序列号
- network: 网络类型 (testnet/mainnet/devnet/localnet)
```

### 获取检查点列表
```
GET /checkpoints?network={network}&limit={limit}&cursor={cursor}&descendingOrder={true|false}
参数:
- network: 网络类型 (testnet/mainnet/devnet/localnet)
- limit: 返回记录数限制(默认10)
- cursor: 游标，用于分页查询
- descendingOrder: 是否降序排列(默认true)
```

### 预估SUI转账Gas费用
```
POST /estimate-transfer-gas-fee
Body: {
  "sender": "发送方地址",
  "recipient": "接收方地址",
  "amount": 转账金额,
  "network": "网络类型"
}
```

### 预估代币转账Gas费用
```
POST /estimate-token-transfer-gas-fee
Body: {
  "sender": "发送方地址",
  "recipient": "接收方地址",
  "amount": 转账数量,
  "coinType": "代币类型",
  "network": "网络类型"
}
```

### 转账 SUI
```
POST /transfer-sui-with-key
Body: {
  "encryptedPrivateKey": "加密后的私钥",
  "recipient": "接收方地址",
  "amount": 转账金额,
  "network": "网络类型"
}
```

### 转账自定义代币
```
POST /transfer-token-with-key
Body: {
  "encryptedPrivateKey": "加密后的私钥",
  "recipient": "接收方地址",
  "amount": 转账数量,
  "coinType": "代币类型",
  "network": "网络类型"
}
```

## Spring Boot集成

使用Hutool库调用上述API接口：

```
// 创建服务实例
SuiBlockchainHutoolService suiService = new SuiBlockchainHutoolService();

// 获取账户余额
Double balance = suiService.getBalance("0x地址", "testnet");

// 查询交易区块
// 示例1: 查询来自特定地址的交易
String transactions1 = suiService.queryTransactionBlocks("testnet", 10, "{\"FromAddress\": \"0x123...\"}");

// 示例2: 查询发送到特定地址的交易
String transactions2 = suiService.queryTransactionBlocks("testnet", 10, "{\"ToAddress\": \"0x456...\"}");

// 示例3: 使用默认参数查询
String transactions3 = suiService.queryTransactionBlocks("testnet", 10);

// 获取交易区块详情
String transactionDetail = suiService.getTransactionBlock("交易摘要", "testnet");

// 获取最新的检查点序列号
String latestCheckpoint = suiService.getLatestCheckpointSequenceNumber("testnet");

// 获取特定检查点信息
String checkpoint = suiService.getCheckpoint("检查点ID", "testnet");

// 获取检查点列表
String checkpoints = suiService.getCheckpoints("testnet", 10);

// 预估SUI转账Gas费用
String gasEstimate1 = suiService.estimateTransferGasFee("发送方地址", "接收方地址", 1000000000L, "testnet");

// 预估代币转账Gas费用
String gasEstimate2 = suiService.estimateTokenTransferGasFee("发送方地址", "接收方地址", 100L, "代币类型", "testnet");

// 转账SUI代币
String txid = suiService.transferSUI(
    "私钥", 
    "0x接收方地址", 
    0.1,
    "testnet"
);

// 转账自定义代币
String txid = suiService.transferToken(
    "私钥",
    "0x接收方地址", 
    100,
    "代币类型",
    "testnet"
);
```

## 安全建议

1. 不要在代码中硬编码私钥
2. 在生产环境中使用HTTPS
3. 使用强随机生成的加密密钥
4. 限制API访问频率
5. 监控和日志记录
6. 定期轮换密钥