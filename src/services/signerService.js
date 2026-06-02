import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromHEX } from '@mysten/sui/utils';
import { decrypt } from '../utils/encryption.js';

/**
 * 从加密的私钥创建签名者
 * @param {string} encryptedPrivateKey - 加密的私钥
 * @returns {Ed25519Keypair} - 签名者对象
 */
export function createSignerFromEncryptedKey(encryptedPrivateKey) {
    try {
        // 解密私钥
        const privateKeyHex = decrypt(encryptedPrivateKey);
        // 创建签名者
        const secretKey = fromHEX(privateKeyHex);
        const keypair = Ed25519Keypair.fromSecretKey(secretKey);
        return keypair;
    } catch (error) {
        throw new Error('私钥解密失败: ' + error.message);
    }
}

/**
 * 安全清除签名者对象中的敏感数据
 * @param {Ed25519Keypair} signer - 签名者对象
 */
export function clearSignerSensitiveData(signer) {
    try {
        // 清除私钥数据
        if (signer.secretKey) {
            // 将私钥数据覆盖为随机数据
            for (let i = 0; i < signer.secretKey.length; i++) {
                signer.secretKey[i] = Math.floor(Math.random() * 256);
            }
        }

        // 清除公钥数据（如果需要）
        if (signer.publicKey && signer.publicKey.data) {
            for (let i = 0; i < signer.publicKey.data.length; i++) {
                signer.publicKey.data[i] = Math.floor(Math.random() * 256);
            }
        }
    } catch (error) {
        // 忽略清除过程中的错误
        console.debug('清除签名者敏感数据时出现错误（可忽略）:', error.message);
    }
}