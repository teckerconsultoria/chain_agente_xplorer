
import { MoralisTransaction, MoralisTokenTransfer, MoralisNFTTransfer, Chain } from '../types';

// Public RPC Endpoints (CORS-friendly selection where possible)
const RPC_URLS: Record<string, string[]> = {
    [Chain.ETH]: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
    [Chain.BSC]: ['https://binance.llamarpc.com', 'https://bsc-dataseed.binance.org'],
    [Chain.POLYGON]: ['https://polygon.llamarpc.com', 'https://polygon-rpc.com'],
    [Chain.AVAX]: ['https://avalanche.llamarpc.com', 'https://api.avax.network/ext/bc/C/rpc'],
    [Chain.FANTOM]: ['https://fantom.llamarpc.com', 'https://rpc.ftm.tools'],
    [Chain.ARBITRUM]: ['https://arbitrum.llamarpc.com', 'https://arb1.arbitrum.io/rpc'],
    [Chain.OPTIMISM]: ['https://optimism.llamarpc.com', 'https://mainnet.optimism.io'],
    [Chain.BASE]: ['https://base.llamarpc.com', 'https://mainnet.base.org'],
    [Chain.CRONOS]: ['https://cronos.drpc.org'],
    [Chain.LINEA]: ['https://linea.drpc.org'],
    [Chain.SCROLL]: ['https://rpc.scroll.io'],
    [Chain.BLAST]: ['https://rpc.blast.io'],
    [Chain.ZKSYNC]: ['https://mainnet.era.zksync.io'],
    [Chain.GNOSIS]: ['https://rpc.gnosischain.com'],
    [Chain.MOONBEAM]: ['https://rpc.api.moonbeam.network'],
    [Chain.CELO]: ['https://forno.celo.org'],
    [Chain.SEPOLIA]: ['https://rpc.sepolia.org'],
};

const CHAIN_NAMES: Record<string, string> = {
    [Chain.ETH]: 'Ethereum',
    [Chain.BSC]: 'BSC',
    [Chain.POLYGON]: 'Polygon',
    [Chain.AVAX]: 'Avalanche',
    [Chain.FANTOM]: 'Fantom',
    [Chain.ARBITRUM]: 'Arbitrum',
    [Chain.OPTIMISM]: 'Optimism',
    [Chain.BASE]: 'Base',
    [Chain.CRONOS]: 'Cronos',
    [Chain.LINEA]: 'Linea',
    [Chain.SCROLL]: 'Scroll',
    [Chain.BLAST]: 'Blast',
    [Chain.ZKSYNC]: 'ZkSync Era',
    [Chain.GNOSIS]: 'Gnosis',
    [Chain.MOONBEAM]: 'Moonbeam',
    [Chain.CELO]: 'Celo',
    [Chain.SEPOLIA]: 'Sepolia',
};

// Event Signatures
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'; // ERC20 & ERC721
const ERC1155_SINGLE = '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62';
const ERC1155_BATCH = '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb';

// Selectors for eth_call
const SYMBOL_SELECTOR = '0x95d89b41';   // symbol()
const DECIMALS_SELECTOR = '0x313ce567'; // decimals()

export class RpcService {
    
    // Hex to decimal string
    private hexToDec(hex: string | undefined): string {
        if (!hex || hex === '0x' || hex === '') return '0';
        try {
            return BigInt(hex).toString();
        } catch (e) {
            return '0';
        }
    }

    private async rpcCall(url: string, method: string, params: any[]): Promise<any> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method,
                    params
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (!res.ok) return null;
            const json = await res.json();
            return json.result;
        } catch (e) {
            return null;
        }
    }

    // New: Fetch Token Metadata via eth_call
    private async getTokenMetadata(url: string, address: string) {
        try {
            // Parallel fetch for symbol and decimals
            const [symbolHex, decimalsHex] = await Promise.all([
                this.rpcCall(url, 'eth_call', [{ to: address, data: SYMBOL_SELECTOR }, 'latest']),
                this.rpcCall(url, 'eth_call', [{ to: address, data: DECIMALS_SELECTOR }, 'latest'])
            ]);

            // Decode Symbol (String)
            let symbol = 'Unknown';
            if (symbolHex && symbolHex !== '0x') {
                try {
                     const hex = symbolHex.replace('0x', '');
                     let str = '';
                     for (let i = 0; i < hex.length; i += 2) {
                         const code = parseInt(hex.substr(i, 2), 16);
                         if (code >= 32 && code <= 126) str += String.fromCharCode(code);
                     }
                     const clean = str.replace(/[^a-zA-Z0-9$]/g, '');
                     if (clean.length > 0) symbol = clean;
                } catch (e) {}
            }

            // Decode Decimals (Uint8)
            let decimals = '18';
            if (decimalsHex && decimalsHex !== '0x') {
                try {
                    decimals = parseInt(decimalsHex, 16).toString();
                } catch (e) {
                    // console.warn("Failed to parse decimals", e);
                }
            }

            return { symbol, decimals };
        } catch (e) {
            return { symbol: 'Unknown', decimals: '18' };
        }
    }

    private async parseLogs(url: string, logs: any[]): Promise<{ erc20: MoralisTokenTransfer[], nft: MoralisNFTTransfer[] }> {
        if (!Array.isArray(logs)) return { erc20: [], nft: [] };
        
        const erc20: MoralisTokenTransfer[] = [];
        const nft: MoralisNFTTransfer[] = [];
        const tokenCache: Record<string, { symbol: string, decimals: string }> = {};

        for (const log of logs) {
            if (!log.topics || log.topics.length === 0) continue;
            
            const contract = log.address;
            const topic0 = log.topics[0];

            try {
                // ERC20 Transfer: Topic0 + 2 indexed args (From, To) = 3 topics. Data = Value.
                if (topic0 === TRANSFER_TOPIC && log.topics.length === 3) {
                    const from = '0x' + log.topics[1].slice(26);
                    const to = '0x' + log.topics[2].slice(26);
                    const value = this.hexToDec(log.data);

                    if (!tokenCache[contract]) tokenCache[contract] = await this.getTokenMetadata(url, contract);
                    const { symbol, decimals } = tokenCache[contract];

                    erc20.push({
                        address: contract, from_address: from, to_address: to, value,
                        token_symbol: symbol, token_name: symbol, token_decimals: decimals,
                    });
                }
                
                // ERC721 Transfer: Topic0 + 3 indexed args (From, To, TokenId) = 4 topics. Data empty/ignored.
                else if (topic0 === TRANSFER_TOPIC && log.topics.length === 4) {
                     const from = '0x' + log.topics[1].slice(26);
                     const to = '0x' + log.topics[2].slice(26);
                     const tokenId = this.hexToDec(log.topics[3]);
                     
                     if (!tokenCache[contract]) tokenCache[contract] = await this.getTokenMetadata(url, contract); // Get Symbol
                     
                     nft.push({
                         token_address: contract, from_address: from, to_address: to, token_id: tokenId,
                         contract_type: 'ERC721', token_symbol: tokenCache[contract].symbol, amount: '1'
                     });
                }

                // ERC1155 TransferSingle: Topic0 + Operator, From, To (3 indexed). Data = ID, Value.
                else if (topic0 === ERC1155_SINGLE) {
                     // topics[1] = operator, topics[2] = from, topics[3] = to
                     const from = '0x' + log.topics[2].slice(26);
                     const to = '0x' + log.topics[3].slice(26);
                     
                     // Data usually contains id (32 bytes) then value (32 bytes)
                     const dataHex = log.data.replace('0x', '');
                     if (dataHex.length >= 128) {
                         const idHex = dataHex.substring(0, 64);
                         const valHex = dataHex.substring(64, 128);
                         
                         nft.push({
                             token_address: contract, from_address: from, to_address: to,
                             token_id: this.hexToDec(idHex), amount: this.hexToDec(valHex),
                             contract_type: 'ERC1155'
                         });
                     }
                }

            } catch (e) {
                // Ignore parsing errors
            }
        }
        return { erc20, nft };
    }

    /**
     * Tries to find a transaction on a specific chain via RPC
     */
    async getTransaction(hash: string, chainId: string): Promise<MoralisTransaction | null> {
        const urls = RPC_URLS[chainId];
        if (!urls) return null;

        for (const url of urls) {
            try {
                // 1. Get Transaction
                const tx = await this.rpcCall(url, 'eth_getTransactionByHash', [hash]);
                if (!tx) continue; // Try next URL

                // 2. Get Receipt (for status and logs)
                const receipt = await this.rpcCall(url, 'eth_getTransactionReceipt', [hash]);
                
                // 3. Get Block (for timestamp)
                let timestamp = new Date().toISOString();
                if (tx.blockNumber) {
                    const block = await this.rpcCall(url, 'eth_getBlockByNumber', [tx.blockNumber, false]);
                    if (block && block.timestamp) {
                        timestamp = new Date(parseInt(block.timestamp, 16) * 1000).toISOString();
                    }
                }

                // 4. Parse Logs
                const { erc20, nft } = receipt ? await this.parseLogs(url, receipt.logs) : { erc20: [], nft: [] };

                return {
                    hash: tx.hash,
                    nonce: this.hexToDec(tx.nonce),
                    transaction_index: this.hexToDec(tx.transactionIndex),
                    from_address: tx.from,
                    to_address: tx.to,
                    value: this.hexToDec(tx.value),
                    gas: this.hexToDec(tx.gas),
                    gas_price: this.hexToDec(tx.gasPrice),
                    input: tx.input,
                    receipt_cumulative_gas_used: receipt ? this.hexToDec(receipt.cumulativeGasUsed) : '0',
                    receipt_gas_used: receipt ? this.hexToDec(receipt.gasUsed) : '0',
                    receipt_contract_address: receipt?.contractAddress || null,
                    receipt_status: receipt ? this.hexToDec(receipt.status) : '1',
                    block_timestamp: timestamp,
                    block_number: this.hexToDec(tx.blockNumber),
                    block_hash: tx.blockHash,
                    erc20_transfers: erc20,
                    nft_transfers: nft,
                    _provider: 'Public RPC',
                    _detected_chain: CHAIN_NAMES[chainId] || chainId
                };

            } catch (e) {
                // Continue to next URL
                continue;
            }
        }
        return null;
    }

    /**
     * Deep Search: Iterates over all supported chains to find the transaction
     */
    async findTransaction(hash: string): Promise<MoralisTransaction | null> {
        // Priority order: Eth, BSC, Polygon, L2s
        const chainOrder = [
            Chain.ETH, Chain.BSC, Chain.POLYGON, 
            Chain.ARBITRUM, Chain.OPTIMISM, Chain.BASE, Chain.AVAX, 
            Chain.FANTOM, Chain.LINEA, Chain.BLAST, Chain.SCROLL, 
            Chain.CRONOS, Chain.GNOSIS, Chain.ZKSYNC
        ];

        for (const chainId of chainOrder) {
            const tx = await this.getTransaction(hash, chainId);
            if (tx) return tx;
        }

        return null;
    }
}
