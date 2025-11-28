
export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  data?: any; // Stores the raw JSON from Moralis if applicable
  toolCallId?: string;
  isThinking?: boolean;
}

// Moralis Types (Simplified)
export interface MoralisTransaction {
  hash: string;
  nonce: string;
  transaction_index: string;
  from_address: string;
  to_address: string;
  value: string;
  gas: string;
  gas_price: string;
  input: string;
  receipt_cumulative_gas_used: string;
  receipt_gas_used: string;
  receipt_contract_address: string | null;
  receipt_status: string;
  block_timestamp: string;
  block_number: string;
  block_hash: string;
  // Extras
  erc20_transfers?: MoralisTokenTransfer[];
  nft_transfers?: MoralisNFTTransfer[];
  internal_transfers?: any[];
  _provider?: string;
  _detected_chain?: string;
  _nativePrice?: number;
  
  // Added properties to support UI and logic
  token_symbol?: string;
  token_decimals?: string;
  token_name?: string;
  _chain?: string;
  _searchedAddress?: string;
  _priceMap?: Record<string, number>;
  _filters?: any;
}

export interface MoralisTokenTransfer {
  transaction_hash?: string;
  address: string; // Token Contract Address
  block_timestamp?: string;
  block_number?: string;
  block_hash?: string;
  to_address: string;
  from_address: string;
  value: string;
  token_name?: string;
  token_symbol?: string;
  token_decimals: string;
}

export interface MoralisNFTTransfer {
  token_address: string;
  token_id: string;
  from_address?: string;
  to_address?: string;
  amount?: string; // For ERC1155
  contract_type?: 'ERC721' | 'ERC1155';
  token_symbol?: string;
  token_name?: string;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  moralisApiKey: string;
  etherscanApiKey: string; // Unified V2 API Key
}

export enum Chain {
  ETH = "0x1",
  GOERLI = "0x5",
  SEPOLIA = "0xaa36a7",
  BSC = "0x38",
  BSC_TESTNET = "0x61",
  POLYGON = "0x89",
  MUMBAI = "0x13881",
  AVAX = "0xa86a",
  FANTOM = "0xfa",
  ARBITRUM = "0xa4b1",
  OPTIMISM = "0xa",
  BASE = "0x2105",
  CRONOS = "0x19",
  LINEA = "0xe708",
  SCROLL = "0x82750",
  BLAST = "0x13e31",
  ZKSYNC = "0x144",
  GNOSIS = "0x64",
  MOONBEAM = "0x504",
  CELO = "0xa4ec"
}
