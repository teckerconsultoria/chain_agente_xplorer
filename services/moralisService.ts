
import { Chain, MoralisTransaction, MoralisTokenTransfer, MoralisNFTTransfer } from '../types';

const BASE_URL = 'https://deep-index.moralis.io/api/v2.2';

// Wrapped Native Token Addresses for Price Lookup
const WRAPPED_NATIVE: Record<string, string> = {
    '0x1': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH (Ethereum)
    '0x89': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC (Polygon)
    '0x38': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB (BSC)
    '0xfa': '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83', // WFTM
    '0xa86a': '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX
    '0xa4b1': '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH (Arb)
    '0x2105': '0x4200000000000000000000000000000000000006', // WETH (Base)
};

export class MoralisService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getHeaders() {
    return {
      'accept': 'application/json',
      'X-API-Key': this.apiKey
    };
  }

  /**
   * Fetches wallet transactions with support for Date Filtering and Auto-Pagination.
   * If limit is high (>100), it will loop through cursors to fetch deep history.
   */
  async getWalletTransactions(
      address: string, 
      chain: string = '0x1', 
      limit: number = 50,
      fromDate?: string,
      toDate?: string
  ): Promise<MoralisTransaction[]> {
    if (!this.apiKey) throw new Error("Moralis API Key is missing");
    
    let allTransactions: MoralisTransaction[] = [];
    let cursor: string | null = null;
    // We fetch in chunks of 100 from the API to be efficient
    const fetchSize = 100; 
    let keepFetching = true;
    let totalFetched = 0;
    
    // Safety cap to prevent browser timeout/memory issues
    const HARD_LIMIT = limit > 2000 ? 2000 : limit; 

    try {
        while (keepFetching && totalFetched < HARD_LIMIT) {
            let url = `${BASE_URL}/${address}?chain=${chain}&limit=${fetchSize}&order=DESC`;
            
            if (cursor) url += `&cursor=${cursor}`;
            if (fromDate) url += `&from_date=${fromDate}`;
            if (toDate) url += `&to_date=${toDate}`;

            const response = await fetch(url, { headers: this.getHeaders() });
            
            if (!response.ok) {
               // If first request fails, throw. If subsequent fails, return what we have.
               if (totalFetched === 0) {
                   const error = await response.json();
                   throw new Error(error.message || 'Failed to fetch wallet transactions');
               }
               break;
            }
            
            const data = await response.json();
            const result = data.result || [];
            
            // Normalize data (native txs usually have 18 decimals)
            const normalized = result.map((tx: any) => ({
                ...tx,
                token_decimals: '18',
                token_symbol: 'Native'
            }));

            allTransactions = [...allTransactions, ...normalized];
            totalFetched += result.length;
            cursor = data.cursor;

            // Stop if no cursor (end of history) or we reached our target limit
            if (!cursor || totalFetched >= HARD_LIMIT) {
                keepFetching = false;
            }
        }
    } catch (e) {
        console.warn(`Error fetching history for ${chain}:`, e);
        if (allTransactions.length === 0) throw e;
    }

    // Trim to requested limit
    return allTransactions.slice(0, limit);
  }

  async getTokenTransfers(address: string, chain: string = '0x1', limit: number = 10): Promise<MoralisTokenTransfer[]> {
    if (!this.apiKey) throw new Error("Moralis API Key is missing");

    const url = `${BASE_URL}/${address}/erc20/transfers?chain=${chain}&limit=${limit}`;
    const response = await fetch(url, { headers: this.getHeaders() });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch token transfers');
    }

    const data = await response.json();
    return data.result;
  }

  async getTransactionByHash(hash: string, chain: string = '0x1'): Promise<MoralisTransaction> {
    if (!this.apiKey) throw new Error("Moralis API Key is missing");

    const url = `${BASE_URL}/transaction/${hash}?chain=${chain}`;
    const response = await fetch(url, { headers: this.getHeaders() });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch transaction');
    }

    return await response.json();
  }

  async getTransactionTokenTransfers(hash: string, chain: string = '0x1'): Promise<MoralisTokenTransfer[]> {
    if (!this.apiKey) return [];

    const url = `${BASE_URL}/transaction/${hash}/erc20/transfers?chain=${chain}`;
    try {
        const response = await fetch(url, { headers: this.getHeaders() });
        if (!response.ok) return [];
        const data = await response.json();
        return data.result || [];
    } catch (e) {
        console.warn("Failed to fetch internal tx transfers", e);
        return [];
    }
  }

  async getTransactionNFTTransfers(hash: string, chain: string = '0x1'): Promise<MoralisNFTTransfer[]> {
    if (!this.apiKey) return [];

    const url = `${BASE_URL}/transaction/${hash}/nft/transfers?chain=${chain}`;
    try {
        const response = await fetch(url, { headers: this.getHeaders() });
        if (!response.ok) return [];
        const data = await response.json();
        return data.result || [];
    } catch (e) {
        console.warn("Failed to fetch nft transfers", e);
        return [];
    }
  }

  async getNativeTokenPrice(chain: string): Promise<number> {
      if (!this.apiKey) return 0;
      
      const address = WRAPPED_NATIVE[chain];
      if (!address) return 0; // Chain not supported for price or is testnet

      const url = `${BASE_URL}/erc20/${address}/price?chain=${chain}`;
      try {
          const response = await fetch(url, { headers: this.getHeaders() });
          if (!response.ok) return 0;
          const data = await response.json();
          return data.usdPrice || 0;
      } catch (e) {
          // console.error("Failed to fetch price", e);
          return 0;
      }
  }

  async getTokenPrice(address: string, chain: string = '0x1'): Promise<number> {
      if (!this.apiKey) return 0;

      const url = `${BASE_URL}/erc20/${address}/price?chain=${chain}`;
      try {
          const response = await fetch(url, { headers: this.getHeaders() });
          if (!response.ok) return 0;
          const data = await response.json();
          return data.usdPrice || 0;
      } catch (e) {
          return 0;
      }
  }
}
