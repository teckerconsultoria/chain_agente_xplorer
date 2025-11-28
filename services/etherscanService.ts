import { MoralisTransaction } from '../types';

const V2_BASE_URL = 'https://api.etherscan.io/v2/api';

// Helper: Safe Hex to Decimal String conversion
const hexToDec = (hex: string | undefined): string => {
    if (!hex || hex === '0x') return '0';
    try {
        return BigInt(hex).toString();
    } catch (e) {
        // console.warn(`Failed to parse hex: ${hex}`, e);
        return '0';
    }
};

// Helper: Safe Hex to Number conversion
const hexToNumber = (hex: string | undefined): string => {
    if (!hex || hex === '0x') return '0';
    try {
        return parseInt(hex, 16).toString();
    } catch (e) {
        return '0';
    }
};

export class EtherscanService {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private getUrl(chainHex: string, params: string): string {
        const chainId = parseInt(chainHex, 16);
        return `${V2_BASE_URL}?chainid=${chainId}&apikey=${this.apiKey}&${params}`;
    }

    /**
     * Fetches "Internal Transactions" which often contain the actual value transfer
     * in contract interactions (e.g., DEX swaps, multisends).
     * Uses Standard API (module=account).
     */
    async getInternalTransactions(hash: string, chain: string) {
        if (!this.apiKey) return [];
        
        // https://docs.etherscan.io/v2/api-endpoints/accounts#get-a-list-of-internal-transactions-by-transaction-hash
        const url = this.getUrl(chain, `module=account&action=txlistinternal&txhash=${hash}`);

        try {
            const response = await fetch(url);
            const data = await response.json();
            
            // Status "0" with message "No transactions found" is a valid result (empty), not an error.
            if (data.status === "1" && Array.isArray(data.result)) {
                return data.result;
            } else if (data.message === "No transactions found") {
                return [];
            }
            
            // Real API error (e.g., Invalid API Key)
            if (data.status === "0" && data.message !== "No transactions found") {
                console.warn("Etherscan V2 API Error (Internal Tx):", data.result || data.message);
            }
            return [];
        } catch (error) {
            console.warn("Failed to fetch Etherscan internal txs", error);
            return [];
        }
    }

    /**
     * Fetch wallet transactions (Standard Tx)
     * Maps Etherscan response to match MoralisTransaction interface for UI compatibility.
     * Uses Standard API (module=account).
     */
    async getWalletTransactions(address: string, chain: string, limit: number = 10): Promise<MoralisTransaction[]> {
        if (!this.apiKey) throw new Error("Etherscan API Key is missing");

        const url = this.getUrl(chain, `module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc`);

        const response = await fetch(url);
        const data = await response.json();

        // Handle specific API errors
        if (data.status === "0") {
             if (data.message === "No transactions found") return [];
             // If the API Key is invalid, Etherscan often returns status "0" with result "Invalid API Key"
             const errorMessage = typeof data.result === 'string' ? data.result : data.message;
             throw new Error(errorMessage || "Failed to fetch from Etherscan V2");
        }

        const results = Array.isArray(data.result) ? data.result : [];

        // Map to MoralisTransaction format
        return results.map((tx: any) => ({
            hash: tx.hash,
            nonce: tx.nonce,
            transaction_index: tx.transactionIndex,
            from_address: tx.from,
            to_address: tx.to,
            value: tx.value, // Etherscan returns decimal string here (not hex) for 'account' endpoints
            gas: tx.gas,
            gas_price: tx.gasPrice,
            input: tx.input,
            receipt_cumulative_gas_used: tx.cumulativeGasUsed,
            receipt_gas_used: tx.gasUsed,
            receipt_contract_address: tx.contractAddress || null,
            receipt_status: tx.txreceipt_status,
            block_timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
            block_number: tx.blockNumber,
            block_hash: tx.blockHash
        } as MoralisTransaction));
    }

    /**
     * Fetch single transaction by hash.
     * Uses PROXY API (module=proxy) to access JSON-RPC methods via V2 endpoint.
     */
    async getTransactionByHash(hash: string, chain: string): Promise<MoralisTransaction> {
        if (!this.apiKey) throw new Error("Etherscan API Key is missing");

        // 1. Get Transaction Info (eth_getTransactionByHash)
        const txUrl = this.getUrl(chain, `module=proxy&action=eth_getTransactionByHash&txhash=${hash}`);
        const txRes = await fetch(txUrl).then(r => r.json());
        
        // CRITICAL: Check for API-level errors (Invalid Key, Rate Limit) which come as { status: "0", message: "NOTOK", result: "..." }
        // even for proxy endpoints sometimes, or standard JSON-RPC errors.
        if (txRes.status === "0" && typeof txRes.result === 'string') {
             throw new Error(`Etherscan API Error: ${txRes.result}`);
        }

        // Check for JSON-RPC errors
        if (txRes.error) throw new Error(txRes.error.message || "Etherscan Proxy Error");
        
        // Check for empty result (Transaction not found on this chain)
        if (!txRes.result) throw new Error("Transaction not found on Etherscan V2");

        const tx = txRes.result;

        // 2. Get Receipt (eth_getTransactionReceipt)
        // We wrap this in try-catch to not fail the whole call if receipt fetch fails (though it shouldn't for confirmed txs)
        let receipt = null;
        try {
            const receiptUrl = this.getUrl(chain, `module=proxy&action=eth_getTransactionReceipt&txhash=${hash}`);
            const receiptRes = await fetch(receiptUrl).then(r => r.json());
            receipt = receiptRes.result;
        } catch (e) {
            console.warn("Failed to fetch receipt", e);
        }

        // 3. Get Block (eth_getBlockByNumber)
        // Needed for Timestamp (Tx object doesn't have it in JSON-RPC)
        let timestamp = new Date().toISOString(); 
        if (tx.blockNumber) {
            const blockUrl = this.getUrl(chain, `module=proxy&action=eth_getBlockByNumber&tag=${tx.blockNumber}&boolean=false`);
            try {
                const blockRes = await fetch(blockUrl).then(r => r.json());
                if (blockRes.result && blockRes.result.timestamp) {
                    timestamp = new Date(parseInt(blockRes.result.timestamp, 16) * 1000).toISOString();
                }
            } catch (e) {
                console.warn("Failed to fetch block timestamp", e);
            }
        }

        // Map to MoralisTransaction format
        // NOTE: Proxy endpoints return HEX strings (0x...) for values.
        return {
            hash: tx.hash,
            nonce: hexToNumber(tx.nonce),
            transaction_index: hexToNumber(tx.transactionIndex),
            from_address: tx.from,
            to_address: tx.to,
            value: hexToDec(tx.value), // Convert Hex Wei to Decimal String
            gas: hexToDec(tx.gas),
            gas_price: hexToDec(tx.gasPrice),
            input: tx.input,
            receipt_cumulative_gas_used: receipt ? hexToDec(receipt.cumulativeGasUsed) : '0',
            receipt_gas_used: receipt ? hexToDec(receipt.gasUsed) : '0',
            receipt_contract_address: receipt?.contractAddress || null,
            receipt_status: receipt ? hexToNumber(receipt.status) : '1', 
            block_timestamp: timestamp,
            block_number: hexToNumber(tx.blockNumber),
            block_hash: tx.blockHash
        } as MoralisTransaction;
    }
}