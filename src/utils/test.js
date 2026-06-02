import { estimateSuiTransferGasFee, estimateTokenTransferGasFee, queryTransactionBlocks } from '../services/suiService.js';

const SENDER_ADDRESS = "0xa740ec72dd8b5bb22d9ee739df47e8befa98670d4f4ffe949711bfef94aef06b";
const RECIPIENT_ADDRESS = "0x8710b4f227c791b77b6787c456a7e028a7a1ae659d2d853537a73a699f0ed3e3";

// BigInt 转换函数
function bigintToJSON(key, value) {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
}

async function testEstimateGasFee() {
    try {
        // console.log("测试: 预估SUI转账Gas费用");

        // // 测试预估SUI转账Gas费用 (使用较小的金额)
        // console.log("\n测试1: 预估SUI转账Gas费用");
        // const gasEstimate1 = await estimateSuiTransferGasFee(SENDER_ADDRESS, RECIPIENT_ADDRESS, 1000, 'testnet');
        // console.log("结果1:", JSON.stringify(gasEstimate1, bigintToJSON, 2));

        // // 测试预估USDC代币转账Gas费用 (正式网)
        // console.log("\n测试2: 预估USDC代币转账Gas费用 (正式网)");
        // const gasEstimate2 = await estimateTokenTransferGasFee("0x935029ca5219502a47ac9b69f556ccf6e2198b5e7815cf50f68846f723739cbd", RECIPIENT_ADDRESS, 1000, '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC', 'mainnet');
        // console.log("结果2:", JSON.stringify(gasEstimate2, bigintToJSON, 2));

        // // 测试预估测试网代币转账Gas费用
        // console.log("\n测试3: 预估测试网代币转账Gas费用");
        // const gasEstimate3 = await estimateTokenTransferGasFee(SENDER_ADDRESS, RECIPIENT_ADDRESS, 1000000, '0x07cdd3c48995e898f6f36c294a086cda0c92a9cb7a8b4ee0b0ebce69a48d59bf::simple_token::SIMPLE_TOKEN', 'testnet');
        // console.log("结果3:", JSON.stringify(gasEstimate3, bigintToJSON, 2));

        const res = await queryTransactionBlocks('testnet', { Checkpoint: '2210917004' }, 100, null);
        console.log(res);

    } catch (error) {
        console.error("错误:", error.message);
        console.error("错误码:", error.code);
        console.error("错误详情:", error);
    }
}

// 运行测试
testEstimateGasFee();