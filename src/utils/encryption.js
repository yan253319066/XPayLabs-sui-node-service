import crypto from 'crypto';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 加密配置
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';

/**
 * AES加密函数
 * @param {string} plainText - 明文
 * @returns {string} - 加密后的数据(Base64格式)
 */
export function encrypt(plainText) {
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
        let encrypted = cipher.update(plainText, 'utf8');
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        // 将IV和加密数据组合
        const combined = Buffer.concat([iv, encrypted]);
        return combined.toString('base64');
    } catch (error) {
        console.error('加密失败:', error);
        throw new Error('数据加密失败: ' + error.message);
    }
}

/**
 * AES解密函数
 * @param {string} encryptedData - 加密的数据(Base64格式)
 * @returns {string} - 解密后的明文
 */
export function decrypt(encryptedData) {
    try {
        // 验证输入数据
        if (!encryptedData) {
            throw new Error('加密数据不能为空');
        }

        if (typeof encryptedData !== 'string') {
            throw new Error('加密数据必须是字符串类型');
        }

        // 验证Base64格式
        if (!/^[A-Za-z0-9+/=]*$/.test(encryptedData)) {
            throw new Error('加密数据不是有效的Base64格式');
        }

        // 解码Base64
        let combined;
        try {
            combined = Buffer.from(encryptedData, 'base64');
        } catch (error) {
            throw new Error('Base64解码失败: ' + error.message);
        }

        // 检查数据长度
        if (combined.length < 16) {
            throw new Error('加密数据长度不足，可能已损坏');
        }

        // 提取IV和加密数据 (AES块大小是16字节)
        const iv = combined.slice(0, 16);
        const encrypted = combined.slice(16);

        // 检查数据完整性
        if (iv.length !== 16) {
            throw new Error('IV长度不正确，应为16字节');
        }

        if (encrypted.length === 0) {
            throw new Error('加密数据为空');
        }

        // 创建解密器
        const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);

        let decrypted = decipher.update(encrypted);

        // 安全地处理final方法
        let finalBuffer;
        try {
            finalBuffer = decipher.final();
        } catch (finalError) {
            throw new Error('解密验证失败，数据可能已损坏或密钥不正确: ' + finalError.message);
        }

        decrypted = Buffer.concat([decrypted, finalBuffer]);

        return decrypted.toString('utf8');
    } catch (error) {
        // 不再输出详细的错误日志，避免暴露敏感信息
        throw new Error('私钥解密失败: ' + error.message);
    }
}