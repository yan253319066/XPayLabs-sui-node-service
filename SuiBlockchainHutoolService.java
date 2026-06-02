import cn.hutool.crypto.Mode;
import cn.hutool.crypto.Padding;
import cn.hutool.crypto.SecureUtil;
import cn.hutool.crypto.symmetric.AES;
import cn.hutool.http.HttpRequest;
import cn.hutool.http.HttpResponse;
import cn.hutool.http.HttpUtil;
import cn.hutool.json.JSONUtil;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * SUI Blockchain Service Call Example (Using Hutool Library)
 * Demonstrates how to securely call SUI transfer service from Spring Boot
 * 
 * Security Architecture:
 * 1. Private keys are stored in the Spring Boot application
 * 2. Private keys are encrypted and transmitted to the Node.js service
 * 3. The Node.js service decrypts the private key, signs the transaction, and immediately discards the private key
 * 4. Transaction results are returned to the Spring Boot application
 */
public class SuiBlockchainHutoolService {
    
    private final String suiServiceUrl = "http://localhost:3000"; // SUI service URL
    
    // Encryption configuration (should be stored in a secure location, such as environment variables or configuration servers)
    private static final String ENCRYPTION_KEY = "your-32-character-encryption-key-here-12345"; // Please replace with actual 32-character key
    
    /**
     * Encrypt using AES-256-CBC (consistent with Node.js side)
     */
    private String encrypt(String plainText) {
        try {
            // Use SHA-256 hash of ENCRYPTION_KEY to ensure it is 32 bytes
            byte[] keyBytes = ENCRYPTION_KEY.getBytes(StandardCharsets.UTF_8);
            if (keyBytes.length != 32) {
                // If not 32 bytes, use hash to ensure correct length
                java.security.MessageDigest sha = java.security.MessageDigest.getInstance("SHA-256");
                keyBytes = sha.digest(keyBytes);
            }
            
            SecretKeySpec secretKeySpec = new SecretKeySpec(keyBytes, "AES");
            Cipher cipher = Cipher.getInstance("AES/CBC/PKCS5Padding");
            
            // Generate 16-byte random IV
            byte[] iv = new byte[16];
            new SecureRandom().nextBytes(iv);
            IvParameterSpec ivSpec = new IvParameterSpec(iv);
            
            cipher.init(Cipher.ENCRYPT_MODE, secretKeySpec, ivSpec);
            
            // Encrypt data
            byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
            
            // Combine IV and encrypted data
            byte[] combined = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(encrypted, 0, combined, iv.length, encrypted.length);
            
            // Return Base64 encoded result
            return Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Encryption failed: " + e.getMessage());
        }
    }
    
    /**
     * Get account balance
     * @param address SUI address
     * @param network Network type (testnet/mainnet/devnet/localnet)
     * @return Balance
     */
    public Double getBalance(String address, String network) {
        try {
            String url = suiServiceUrl + "/balance/" + address + "?network=" + network;
            HttpResponse response = HttpUtil.get(url);
            if (response.getStatus() == 200) {
                // Use Hutool to parse JSON response
                String body = response.body();
                Map<String, Object> resultMap = JSONUtil.parseObj(body);
                return ((Double) resultMap.get("balance"));
            }
            return 0.0;
        } catch (Exception e) {
            e.printStackTrace();
            return 0.0;
        }
    }
    
    /**
     * Query transaction blocks
     * @param network Network type (testnet/mainnet/devnet/localnet)
     * @param limit Limit on number of records returned
     * @param query Query conditions (JSON string format)
     * @return JSON string of transaction block list
     * 
     * Query parameter examples:
     * 1. Query transactions from a specific address:
     *    {"FromAddress": "0x123..."}
     * 2. Query transactions to a specific address:
     *    {"ToAddress": "0x456..."}
     * 3. Query all transactions involving a specific address:
     *    {"FromOrToAddress": "0x789..."}
     * 4. Query transactions of a specific type:
     *    {"Checkpoint": checkpointSequenceNumber}
     * 5. Query transactions related to a move module:
     *    {"MoveModule": {"package": "0x...", "module": "moduleName"}}
     * 6. Query transactions related to a move function:
     *    {"MoveFunction": {"package": "0x...", "module": "moduleName", "function": "functionName"}}
     */
    public String queryTransactionBlocks(String network, int limit, String query) {
        try {
            String url = suiServiceUrl + "/transaction-blocks?network=" + network + "&limit=" + limit;
            
            // Add query conditions
            if (query != null && !query.isEmpty()) {
                // Parse query parameter and add to URL
                Map<String, Object> queryMap = JSONUtil.parseObj(query);
                for (Map.Entry<String, Object> entry : queryMap.entrySet()) {
                    // For complex objects, special handling is required
                    if (entry.getValue() instanceof Map) {
                        // Handle nested objects
                        Map<String, Object> nestedMap = (Map<String, Object>) entry.getValue();
                        for (Map.Entry<String, Object> nestedEntry : nestedMap.entrySet()) {
                            url += "&" + entry.getKey() + "." + nestedEntry.getKey() + "=" + nestedEntry.getValue();
                        }
                    } else {
                        url += "&" + entry.getKey() + "=" + entry.getValue();
                    }
                }
            }
            
            HttpResponse response = HttpUtil.get(url);
            if (response.getStatus() == 200) {
                return response.body();
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
    
    // Add an overloaded method to maintain backward compatibility
    public String queryTransactionBlocks(String network, int limit) {
        return queryTransactionBlocks(network, limit, null);
    }

    /**
     * Get transaction block details
     * @param digest Transaction digest
     * @param network Network type (testnet/mainnet/devnet/localnet)
     * @return JSON string of transaction block details
     */
    public String getTransactionBlock(String digest, String network) {
        try {
            String url = suiServiceUrl + "/transaction-block/" + digest + "?network=" + network;
            HttpResponse response = HttpUtil.get(url);
            if (response.getStatus() == 200) {
                return response.body();
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Get the latest checkpoint sequence number
     * @param network Network type (testnet/mainnet/devnet/localnet)
     * @return Latest checkpoint sequence number
     */
    public String getLatestCheckpointSequenceNumber(String network) {
        try {
            String url = suiServiceUrl + "/checkpoint/latest?network=" + network;
            HttpResponse response = HttpUtil.get(url);
            if (response.getStatus() == 200) {
                return response.body();
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Get checkpoint information
     * @param checkpointId Checkpoint ID or sequence number
     * @param network Network type (testnet/mainnet/devnet/localnet)
     * @return JSON string of checkpoint information
     */
    public String getCheckpoint(String checkpointId, String network) {
        try {
            String url = suiServiceUrl + "/checkpoint/" + checkpointId + "?network=" + network;
            HttpResponse response = HttpUtil.get(url);
            if (response.getStatus() == 200) {
                return response.body();
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Get checkpoint list
     * @param network Network type (testnet/mainnet/devnet/localnet)
     * @param limit Limit on number of records returned
     * @param cursor Cursor for pagination
     * @param descendingOrder Whether to sort in descending order
     * @return JSON string of checkpoint list
     */
    public String getCheckpoints(String network, int limit, String cursor, boolean descendingOrder) {
        try {
            String url = suiServiceUrl + "/checkpoints?network=" + network + "&limit=" + limit;
            if (cursor != null && !cursor.isEmpty()) {
                url += "&cursor=" + cursor;
            }
            url += "&descendingOrder=" + descendingOrder;
            
            HttpResponse response = HttpUtil.get(url);
            if (response.getStatus() == 200) {
                return response.body();
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
    
    // Add an overloaded method with default parameters
    public String getCheckpoints(String network, int limit) {
        return getCheckpoints(network, limit, null, true);
    }

    /**
     * Transfer SUI tokens
     * @param privateKeyHex Sender private key (hexadecimal format)
     * @param recipient Recipient address
     * @param amount Transfer amount
     * @param network Network type (testnet/mainnet/devnet/localnet)
     * @return Transaction ID
     */
    public String transferSUI(String privateKeyHex, String recipient, double amount, String network) {
        try {
            // Use Hutool to encrypt private key
            String encryptedPrivateKey = encrypt(privateKeyHex);
            
            String url = suiServiceUrl + "/transfer-sui-with-key";
            
            // Build request parameters
            Map<String, Object> request = new HashMap<>();
            request.put("encryptedPrivateKey", encryptedPrivateKey);
            request.put("recipient", recipient);
            request.put("amount", amount);
            request.put("network", network);
            
            // Send POST request
            HttpResponse response = HttpRequest.post(url)
                    .body(JSONUtil.toJsonStr(request))
                    .execute();
            
            if (response.getStatus() == 200) {
                String body = response.body();
                Map<String, Object> resultMap = JSONUtil.parseObj(body);
                Boolean success = (Boolean) resultMap.get("success");
                if (success != null && success) {
                    return (String) resultMap.get("txid");
                }
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Transfer custom tokens
     * @param privateKeyHex Sender private key (hexadecimal format)
     * @param recipient Recipient address
     * @param amount Transfer amount
     * @param coinType Token type
     * @param network Network type (testnet/mainnet/devnet/localnet)
     * @return Transaction ID
     */
    public String transferToken(String privateKeyHex, String recipient, int amount, String coinType, String network) {
        try {
            // Use Hutool to encrypt private key
            String encryptedPrivateKey = encrypt(privateKeyHex);
            
            String url = suiServiceUrl + "/transfer-token-with-key";
            
            // Build request parameters
            Map<String, Object> request = new HashMap<>();
            request.put("encryptedPrivateKey", encryptedPrivateKey);
            request.put("recipient", recipient);
            request.put("amount", amount);
            request.put("coinType", coinType);
            request.put("network", network);
            
            // Send POST request
            HttpResponse response = HttpRequest.post(url)
                    .body(JSONUtil.toJsonStr(request))
                    .execute();
            
            if (response.getStatus() == 200) {
                String body = response.body();
                Map<String, Object> resultMap = JSONUtil.parseObj(body);
                Boolean success = (Boolean) resultMap.get("success");
                if (success != null && success) {
                    return (String) resultMap.get("txid");
                }
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Estimate gas fee for token transfer
     * @param sender Sender address
     * @param recipient Recipient address
     * @param amount Transfer amount
     * @param coinType Token type
     * @param network Network type (testnet/mainnet/devnet/localnet)
     * @return JSON string of gas fee estimation result
     */
    public String estimateTokenTransferGasFee(String sender, String recipient, long amount, String coinType, String network) {
        try {
            String url = suiServiceUrl + "/estimate-token-transfer-gas-fee";
            
            // Build request parameters
            Map<String, Object> request = new HashMap<>();
            request.put("sender", sender);
            request.put("recipient", recipient);
            request.put("amount", amount);
            request.put("coinType", coinType);
            request.put("network", network);
            
            // Send POST request
            HttpResponse response = HttpRequest.post(url)
                    .body(JSONUtil.toJsonStr(request))
                    .execute();
            
            if (response.getStatus() == 200) {
                return response.body();
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
    
    /**
     * Estimate gas fee for SUI transfer
     * @param sender Sender address
     * @param recipient Recipient address
     * @param amount Transfer amount
     * @param network Network type (testnet/mainnet/devnet/localnet)
     * @return JSON string of gas fee estimation result
     */
    public String estimateTransferGasFee(String sender, String recipient, long amount, String network) {
        try {
            String url = suiServiceUrl + "/estimate-transfer-gas-fee";
            
            // Build request parameters
            Map<String, Object> request = new HashMap<>();
            request.put("sender", sender);
            request.put("recipient", recipient);
            request.put("amount", amount);
            request.put("network", network);
            
            // Send POST request
            HttpResponse response = HttpRequest.post(url)
                    .body(JSONUtil.toJsonStr(request))
                    .execute();
            
            if (response.getStatus() == 200) {
                return response.body();
            }
            return null;
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}