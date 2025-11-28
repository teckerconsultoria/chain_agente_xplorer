import { GoogleGenAI, FunctionDeclaration, Type, Tool } from "@google/genai";
import { MoralisService } from "./moralisService";
import { EtherscanService } from "./etherscanService";
import { RpcService } from "./rpcService";
import { Chain, MoralisTransaction, MoralisTokenTransfer } from "../types";

// Helper to sanitize chain IDs
const normalizeChain = (chainInput: string): string => {
    if (!chainInput) return '0x1';
    if (chainInput.toLowerCase() === 'all') return 'all';
    
    const chainMap: Record<string, string> = {
        'eth': '0x1', 'ethereum': '0x1', 'mainnet': '0x1',
        'polygon': '0x89', 'matic': '0x89',
        'bsc': '0x38', 'binance': '0x38',
        'sepolia': '0xaa36a7',
        'mumbai': '0x13881',
        'avax': '0xa86a', 'avalanche': '0xa86a',
        'fantom': '0xfa', 'ftm': '0xfa',
        'arbitrum': '0xa4b1', 'arb': '0xa4b1',
        'optimism': '0xa', 'op': '0xa',
        'base': '0x2105',
        'cronos': '0x19',
        'linea': '0xe708'
    };
    return chainMap[chainInput.toLowerCase()] || chainInput;
};

// Chains to scan when "all" is requested (Prioritized by popularity)
const MULTI_CHAIN_SCAN_LIST = [
    Chain.ETH,
    Chain.BSC,
    Chain.POLYGON,
    Chain.ARBITRUM,
    Chain.OPTIMISM,
    Chain.BASE,
    Chain.AVAX,
    Chain.FANTOM
];

// Tool Definitions
const getWalletTransactionsTool: FunctionDeclaration = {
    name: "get_wallet_transactions",
    description: "Get the transaction history for a wallet. Supports date filtering, direction filtering, and scanning ALL chains.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            address: { type: Type.STRING, description: "The wallet address (e.g., 0x...)" },
            chain: { type: Type.STRING, description: "Optional. The blockchain ID (e.g., 0x1) OR 'all' to scan all major networks. Defaults to Ethereum." },
            limit: { type: Type.NUMBER, description: "Number of transactions to fetch per chain. Default 50. Increase for deep history." },
            fromDate: { type: Type.STRING, description: "Optional. Start date in 'YYYY-MM-DD' format." },
            toDate: { type: Type.STRING, description: "Optional. End date in 'YYYY-MM-DD' format." },
            direction: { type: Type.STRING, description: "Optional. 'in', 'out', or 'all'. Defaults to 'all'." },
            stablecoins_only: { type: Type.BOOLEAN, description: "Optional. If true, filters for USDT, USDC, DAI, etc." },
            provider: { type: Type.STRING, description: "The API provider to use. 'moralis' is best for multi-chain history." }
        },
        required: ["address"]
    }
};

const getTokenTransfersTool: FunctionDeclaration = {
    name: "get_token_transfers",
    description: "Get ERC20 token transfers for a specific wallet address. (Only Moralis supported)",
    parameters: {
        type: Type.OBJECT,
        properties: {
            address: { type: Type.STRING, description: "The wallet address" },
            chain: { type: Type.STRING, description: "Optional. The blockchain ID." },
            limit: { type: Type.NUMBER, description: "Number of transfers to fetch" }
        },
        required: ["address"]
    }
};

const getTransactionByHashTool: FunctionDeclaration = {
    name: "get_transaction_by_hash",
    description: "Get details of a specific transaction using its hash. Supports Deep Search via RPC.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            hash: { type: Type.STRING, description: "The transaction hash (0x...)" },
            chain: { type: Type.STRING, description: "Optional. The blockchain ID." },
            provider: { type: Type.STRING, description: "The API provider to use. Must be 'moralis', 'etherscan', or 'rpc'." }
        },
        required: ["hash", "provider"]
    }
};

const tools: Tool[] = [{
    functionDeclarations: [getWalletTransactionsTool, getTokenTransfersTool, getTransactionByHashTool]
}];

// Expanded list for Deep Search (Hash Lookup)
const SEARCH_CHAINS = [
    Chain.ETH, Chain.BSC, Chain.POLYGON, 
    Chain.ARBITRUM, Chain.OPTIMISM, Chain.AVAX, 
    Chain.BASE, Chain.FANTOM, Chain.LINEA, 
    Chain.BLAST, Chain.SCROLL, Chain.CRONOS,
    Chain.GNOSIS, Chain.ZKSYNC, Chain.SEPOLIA
];

const CHAIN_NAMES: Record<string, string> = {
    [Chain.ETH]: 'Ethereum',
    [Chain.BSC]: 'BSC',
    [Chain.POLYGON]: 'Polygon',
    [Chain.ARBITRUM]: 'Arbitrum',
    [Chain.OPTIMISM]: 'Optimism',
    [Chain.AVAX]: 'Avalanche',
    [Chain.FANTOM]: 'Fantom',
    [Chain.BASE]: 'Base',
    [Chain.SEPOLIA]: 'Sepolia',
    [Chain.CRONOS]: 'Cronos',
    [Chain.LINEA]: 'Linea',
    [Chain.SCROLL]: 'Scroll',
    [Chain.BLAST]: 'Blast',
    [Chain.ZKSYNC]: 'ZkSync',
    [Chain.GNOSIS]: 'Gnosis'
};

export class GeminiAgent {
    private ai: GoogleGenAI;
    private moralis: MoralisService;
    private etherscan: EtherscanService;
    private rpc: RpcService;

    constructor(moralisKey: string, etherscanKey: string = '') {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        this.moralis = new MoralisService(moralisKey);
        this.etherscan = new EtherscanService(etherscanKey);
        this.rpc = new RpcService();
    }

    // Helper: Merge Native and Token Transactions to fix "Zero Value" issues
    private mergeTransactions(native: MoralisTransaction[], tokens: MoralisTokenTransfer[]): MoralisTransaction[] {
        const txMap = new Map<string, MoralisTransaction>();

        // 1. Add Native Transactions to Map
        for (const tx of native) {
            txMap.set(tx.hash, { ...tx });
        }

        // 2. Merge Token Transfers
        for (const token of tokens) {
            const existing = txMap.get(token.transaction_hash || '');
            if (existing) {
                // If existing, enrich it (Primary Token Transfer Logic)
                if (!existing.erc20_transfers) existing.erc20_transfers = [];
                existing.erc20_transfers.push(token);

                // If native value is 0, adopt token value for display
                if (existing.value === '0') {
                    existing.value = token.value;
                    existing.token_symbol = token.token_symbol;
                    existing.token_decimals = token.token_decimals;
                }
            } else {
                // If not in native list (e.g., internal tx that Moralis missed in native endpoint?), add it as a pseudo-tx
                txMap.set(token.transaction_hash || `token-${Date.now()}`, {
                    hash: token.transaction_hash || '',
                    from_address: token.from_address,
                    to_address: token.to_address,
                    value: token.value,
                    block_timestamp: token.block_timestamp || new Date().toISOString(),
                    block_number: token.block_number || '0',
                    token_symbol: token.token_symbol,
                    token_decimals: token.token_decimals,
                    receipt_status: '1',
                    // Defaults
                    nonce: '0', transaction_index: '0', gas: '0', gas_price: '0', input: '0x',
                    receipt_cumulative_gas_used: '0', receipt_gas_used: '0', receipt_contract_address: null, block_hash: ''
                } as MoralisTransaction);
            }
        }

        return Array.from(txMap.values());
    }

    async sendMessage(
        history: any[], 
        message: string, 
        onToolResult: (toolName: string, data: any) => void
    ): Promise<string> {
        const model = "gemini-2.5-flash";
        
        const contents = [
             { role: 'user', parts: [{ text: `System: You are an expert Blockchain Analyst. You speak Portuguese.
             
             IMPORTANT RULES:
             1. **PROVIDER**: Ask user for provider ('Moralis', 'Etherscan', 'RPC') if ambiguous. Default to 'Moralis' for wallet history as it supports multi-chain filtering best.
             2. **MULTICHAIN**: If user asks for "all chains" or "full history", set chain='all' in the tool.
             3. **DATES**: If user mentions dates (e.g. "since Jan 2024"), convert to 'YYYY-MM-DD'.
             4. **VALUES**: Always prioritize 'erc20_transfers' or logs for real values if native value is 0. Check for NFT transfers (ERC721/1155) too.
             5. **ANALYSIS**: Concisely summarize: Chains found, date range covered, and total transactions count.` }] },
            ...history.map(msg => ({
                role: msg.role === 'model' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            })),
            { role: 'user', parts: [{ text: message }] }
        ];

        const result = await this.ai.models.generateContent({
            model,
            contents,
            config: {
                tools,
                systemInstruction: "You are a helpful blockchain agent. Check internal transfers, logs, and NFTs for real value. Respond in Portuguese.",
            }
        });

        const firstResponse = result.candidates?.[0];
        const functionCalls = firstResponse?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);

        if (functionCalls && functionCalls.length > 0) {
            const functionResponses = [];

            for (const call of functionCalls) {
                if (!call || !call.name) continue;
                
                let toolResult: any = { error: "Unknown tool" };
                const args: any = call.args;
                let detectedChain = '0x1'; 
                const provider = (args.provider || 'moralis').toLowerCase();

                try {
                    if (call.name === 'get_transaction_by_hash') {
                        // ... (Hash Lookup Logic - Unchanged) ...
                        let apiSuccess = false;
                        if (provider === 'rpc') {
                            const rpcTx = await this.rpc.findTransaction(args.hash);
                            if (rpcTx) {
                                toolResult = rpcTx;
                                detectedChain = Object.keys(CHAIN_NAMES).find(key => CHAIN_NAMES[key] === rpcTx._detected_chain) || '0x1';
                            } else {
                                toolResult = { error: "Transaction not found on any public RPC node." };
                            }
                        }
                        else if (provider === 'etherscan' && this.etherscan) {
                            try {
                                if (args.chain) {
                                    detectedChain = normalizeChain(args.chain);
                                    toolResult = await this.etherscan.getTransactionByHash(args.hash, detectedChain);
                                    apiSuccess = true;
                                } else {
                                    for (const chain of SEARCH_CHAINS) {
                                        try {
                                            const res = await this.etherscan.getTransactionByHash(args.hash, chain);
                                            if (res && res.hash) {
                                                toolResult = { ...res, _detected_chain: CHAIN_NAMES[chain] || chain };
                                                detectedChain = chain;
                                                apiSuccess = true;
                                                break;
                                            }
                                        } catch (e: any) {
                                            if (e.message.includes("Invalid API Key")) break; 
                                        }
                                    }
                                }
                            } catch (e) { }
                        } 
                        else if (this.moralis) {
                            try {
                                if (args.chain) {
                                    detectedChain = normalizeChain(args.chain);
                                    toolResult = await this.moralis.getTransactionByHash(args.hash, detectedChain);
                                    apiSuccess = true;
                                } else {
                                    for (const chain of SEARCH_CHAINS) {
                                        try {
                                            const res = await this.moralis.getTransactionByHash(args.hash, chain);
                                            if (res && res.hash) {
                                                toolResult = { ...res, _detected_chain: CHAIN_NAMES[chain] || chain };
                                                detectedChain = chain;
                                                apiSuccess = true;
                                                break;
                                            }
                                        } catch (e) {}
                                    }
                                }
                            } catch (e) { }
                        }

                        if (provider !== 'rpc' && !apiSuccess) {
                            const rpcTx = await this.rpc.findTransaction(args.hash);
                            if (rpcTx) {
                                toolResult = rpcTx;
                                detectedChain = Object.keys(CHAIN_NAMES).find(key => CHAIN_NAMES[key] === rpcTx._detected_chain) || '0x1';
                            } else {
                                toolResult = { error: "Transaction not found." };
                            }
                        }

                        if (!toolResult.error && toolResult.hash) {
                            toolResult._detected_chain = toolResult._detected_chain || CHAIN_NAMES[detectedChain] || detectedChain;
                            toolResult._searchedAddress = args.hash; 

                            if (!toolResult._provider || toolResult._provider !== 'Public RPC') {
                                if (this.moralis) {
                                    if (!toolResult.erc20_transfers) {
                                        toolResult.erc20_transfers = await this.moralis.getTransactionTokenTransfers(toolResult.hash, detectedChain);
                                    }
                                    if (!toolResult.nft_transfers) {
                                        toolResult.nft_transfers = await this.moralis.getTransactionNFTTransfers(toolResult.hash, detectedChain);
                                    }
                                }
                                if (this.etherscan && !toolResult.internal_transfers) {
                                    const internalTxs = await this.etherscan.getInternalTransactions(toolResult.hash, detectedChain);
                                    if (internalTxs.length > 0) toolResult.internal_transfers = internalTxs;
                                }
                            }
                            if (toolResult.erc20_transfers && toolResult.erc20_transfers.length > 0 && this.moralis) {
                                try {
                                    const firstToken = toolResult.erc20_transfers[0];
                                    if (firstToken.address) {
                                        const tokenPrice = await this.moralis.getTokenPrice(firstToken.address, detectedChain);
                                        toolResult._tokenPrice = tokenPrice;
                                    }
                                } catch (e) { }
                            }
                        }

                    } else if (call.name === 'get_wallet_transactions') {
                        const rawChain = args.chain ? normalizeChain(args.chain) : '0x1';
                        const limit = args.limit || 50;
                        const priceMap: Record<string, number> = {};

                        if (rawChain === 'all') {
                            // MULTI-CHAIN SCAN with MERGE Strategy
                            if (provider === 'rpc') {
                                toolResult = { error: "RPC does not support multi-chain wallet scanning. Use Moralis." };
                            } else {
                                console.log(`Scanning multiple chains for wallet: ${args.address}`);
                                const promises = MULTI_CHAIN_SCAN_LIST.map(async (chainId) => {
                                    try {
                                        // 1. Fetch Native
                                        const nativeTxs = await this.moralis.getWalletTransactions(
                                            args.address, chainId, limit, args.fromDate, args.toDate
                                        );
                                        // 2. Fetch Tokens
                                        const tokenTxs = await this.moralis.getTokenTransfers(
                                            args.address, chainId, limit
                                        );
                                        // 3. Merge
                                        const merged = this.mergeTransactions(nativeTxs, tokenTxs);
                                        
                                        return merged.map(tx => ({
                                            ...tx, 
                                            _detected_chain: CHAIN_NAMES[chainId],
                                            _chain: CHAIN_NAMES[chainId] 
                                        }));
                                    } catch (e) {
                                        return [];
                                    }
                                });
                                
                                const results = await Promise.all(promises);
                                const aggregated = results.flat().sort((a, b) => 
                                    new Date(b.block_timestamp).getTime() - new Date(a.block_timestamp).getTime()
                                );

                                // Fetch prices
                                const uniqueChains = Array.from(new Set(aggregated.map(tx => tx._detected_chain)));
                                for (const cName of uniqueChains) {
                                    const cId = Object.keys(CHAIN_NAMES).find(k => CHAIN_NAMES[k] === cName);
                                    if(cId) {
                                        const price = await this.moralis.getNativeTokenPrice(cId);
                                        priceMap[cName] = price;
                                    }
                                }

                                toolResult = { 
                                    transactions: aggregated, 
                                    _chain: 'Multi-Chain', 
                                    _searchedAddress: args.address,
                                    _priceMap: priceMap,
                                    _filters: { 
                                        from: args.fromDate, 
                                        to: args.toDate, 
                                        direction: args.direction,
                                        stablecoinsOnly: args.stablecoins_only 
                                    }
                                };
                            }

                        } else {
                            // SINGLE CHAIN with MERGE Strategy
                            detectedChain = rawChain;
                            if (provider === 'etherscan') {
                                const txs = await this.etherscan.getWalletTransactions(args.address, detectedChain, limit);
                                toolResult = { 
                                    transactions: txs, 
                                    _chain: CHAIN_NAMES[detectedChain] || detectedChain, 
                                    _searchedAddress: args.address 
                                };
                            } else {
                                // Moralis Single Chain
                                const nativeTxs = await this.moralis.getWalletTransactions(
                                    args.address, detectedChain, limit, args.fromDate, args.toDate
                                );
                                const tokenTxs = await this.moralis.getTokenTransfers(
                                    args.address, detectedChain, limit
                                );
                                const merged = this.mergeTransactions(nativeTxs, tokenTxs);

                                const cName = CHAIN_NAMES[detectedChain] || detectedChain;
                                const price = await this.moralis.getNativeTokenPrice(detectedChain);
                                priceMap[cName] = price;

                                toolResult = { 
                                    transactions: merged, 
                                    _chain: cName, 
                                    _searchedAddress: args.address,
                                    _priceMap: priceMap,
                                    _nativePrice: price, 
                                    _filters: { 
                                        from: args.fromDate, 
                                        to: args.toDate, 
                                        direction: args.direction,
                                        stablecoinsOnly: args.stablecoins_only
                                    }
                                };
                            }
                        }

                    } else if (call.name === 'get_token_transfers') {
                        detectedChain = args.chain ? normalizeChain(args.chain) : '0x1';
                        const transfers = await this.moralis.getTokenTransfers(args.address, detectedChain, args.limit || 20);
                        toolResult = { transfers: transfers, _chain: CHAIN_NAMES[detectedChain] || detectedChain, _searchedAddress: args.address };
                    }

                    if (!toolResult.error && !toolResult._nativePrice && detectedChain && detectedChain !== 'all' && call.name === 'get_transaction_by_hash') {
                        const price = await this.moralis.getNativeTokenPrice(detectedChain);
                        toolResult._nativePrice = price;
                        if (!toolResult._provider) toolResult._provider = provider === 'rpc' ? 'Public RPC' : provider;
                    }

                } catch (err: any) {
                    toolResult = { error: err.message };
                }

                onToolResult(call.name, toolResult);
                functionResponses.push({ name: call.name, response: { result: toolResult } });
            }

            const finalResult = await this.ai.models.generateContent({
                model,
                contents: [
                    ...contents,
                    { role: 'model', parts: firstResponse?.content?.parts || [] },
                    { role: 'user', parts: functionResponses.map(fr => ({
                        functionResponse: { name: fr.name, response: fr.response }
                    }))}
                ],
                config: { tools }
            });

            return finalResult.text || "";
        }

        return firstResponse?.content?.parts?.[0]?.text || "";
    }
}