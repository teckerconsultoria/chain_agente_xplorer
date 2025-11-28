import React, { useMemo, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MoralisTransaction, MoralisTokenTransfer } from '../types';

interface TransactionCardProps {
  data: any; // Can be array, object, or wrapper object with metadata
  type: 'tx' | 'token';
}

// Known Stablecoin Symbols for Filtering
const STABLECOINS = [
    'USDT', 'USDC', 'DAI', 'BUSD', 'FDUSD', 'TUSD', 
    'USDP', 'USDD', 'USDE', 'PYUSD', 'GUSD', 'FRAX', 'LUSD'
];

// Icons
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
);

const JsonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);

const BoltIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
);

const LinkIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
);

const FileIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
);

const ImageIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
);

const truncate = (str: string, n: number) => (str && str.length > n ? str.substr(0, n - 1) + '...' + str.substr(str.length - 4) : str);

// Generate a color based on address for "Identicon" placeholder
const getAddressColor = (address: string) => {
    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500', 'bg-indigo-500'];
    const charCode = address ? address.charCodeAt(address.length - 1) : 0;
    return colors[charCode % colors.length];
};

const Identicon = ({ address }: { address: string }) => (
    <div className={`w-6 h-6 rounded-full ${getAddressColor(address)} flex items-center justify-center text-[10px] font-bold text-white shadow-inner border border-white/10 shrink-0`}>
        {address ? address.substring(2, 4).toUpperCase() : '??'}
    </div>
);

// ROBUST VALUE FORMATTING
const formatCryptoValue = (val: string | number | undefined | null, decimals: number | string = 18): string => {
    if (val === undefined || val === null || val === '') return '0';
    const valStr = val.toString();
    if (valStr === '0') return '0';

    const d = typeof decimals === 'string' ? parseInt(decimals) : decimals;
    if (isNaN(d)) return '0';
    
    // Convert hex to dec if needed
    let cleanVal = valStr;
    if (valStr.startsWith('0x')) {
        try {
            cleanVal = BigInt(valStr).toString();
        } catch { return '0'; }
    } else {
        cleanVal = valStr.split('.')[0]; 
    }
    
    const isNegative = cleanVal.startsWith('-');
    if (isNegative) cleanVal = cleanVal.substring(1);

    const padded = cleanVal.padStart(d + 1, '0');
    
    const splitIdx = padded.length - d;
    const integerPart = padded.slice(0, splitIdx);
    let fractionalPart = padded.slice(splitIdx);
    
    fractionalPart = fractionalPart.replace(/0+$/, '');
    
    let result = integerPart;
    if (fractionalPart.length > 0) {
        result += '.' + fractionalPart;
    }
    
    return isNegative ? '-' + result : result;
};

// Helper for display formatting
const formatDisplayNumber = (valStr: string, isFiatLike: boolean = false) => {
    if (!valStr) return '0';
    const parts = valStr.split('.');
    const intPart = parts[0];
    const fracPart = parts[1] || '';
    
    const intDisplay = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    
    if (isFiatLike) {
        if (fracPart.length < 2) return `${intDisplay}.${fracPart.padEnd(2, '0')}`;
        return `${intDisplay}.${fracPart.substring(0, 2)}`;
    }

    // Cap decimals at 6 for display unless it's very small
    if (fracPart.length > 6) {
        return `${intDisplay}.${fracPart.substring(0, 6)}...`;
    }

    return fracPart ? `${intDisplay}.${fracPart}` : intDisplay;
};

const parseToFloat = (fmtVal: string) => parseFloat(fmtVal.replace(/,/g, ''));

const formatCurrency = (amount: number) => {
    if (amount < 0.01 && amount > 0) return '< $0.01';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const getRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} secs ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 30) return `${diffInDays} days ago`;
    const diffInMonths = Math.floor(diffInDays / 30);
    if (diffInMonths < 12) return `${diffInMonths} months ago`;
    return `${Math.floor(diffInDays / 365)} years ago`;
};

// Heuristic to detect transaction method
const getMethod = (input: string, to: string, from: string, value: string) => {
    if (!input || input === '0x') return 'Transfer';
    const methodId = input.substring(0, 10);
    switch (methodId) {
        case '0xa9059cbb': return 'Transfer';
        case '0x095ea7b3': return 'Approve';
        case '0x23b872dd': return 'TransferFrom';
        case '0x60806040': return 'Contract Creation';
        default: return 'Contract Call';
    }
};

export const TransactionCard: React.FC<TransactionCardProps> = ({ data, type }) => {
  let items: any[] = [];
  let singleTx: any = null;
  let nativePrice = 0;
  let tokenPrice = 0;
  let chainName = '';
  let providerName = '';
  let searchedAddress = '';
  let filters: { from?: string, to?: string, direction?: string, stablecoinsOnly?: boolean } = {};
  let erc20Transfers: any[] = [];
  let internalTransfers: any[] = [];
  let nftTransfers: any[] = [];
  let priceMap: Record<string, number> = {};

  const [uiDirectionFilter, setUiDirectionFilter] = useState<'all' | 'in' | 'out'>('all');

  // Determine if this is a single TX view or a List view
  if (Array.isArray(data)) {
      items = data;
  } else if (data && typeof data === 'object') {
      if (data.transactions) items = data.transactions;
      else if (data.transfers) items = data.transfers;
      else {
          singleTx = data;
          items = [data]; 
          if (data.erc20_transfers) erc20Transfers = data.erc20_transfers;
          if (data.internal_transfers) internalTransfers = data.internal_transfers;
          if (data.nft_transfers) nftTransfers = data.nft_transfers;
      }

      if (data._nativePrice) nativePrice = data._nativePrice;
      if (data._priceMap) priceMap = data._priceMap; 
      if (data._tokenPrice) tokenPrice = data._tokenPrice;
      if (data._chain || data._detected_chain) chainName = data._chain || data._detected_chain;
      if (data._provider) providerName = data._provider;
      if (data._searchedAddress) searchedAddress = data._searchedAddress.toLowerCase();
      if (data._filters) filters = data._filters;
  }

  // Filter Items based on UI Direction and Stablecoin filter
  const filteredItems = items.filter(item => {
      // Direction Filter
      if (searchedAddress && uiDirectionFilter !== 'all') {
          const isOut = item.from_address && item.from_address.toLowerCase() === searchedAddress;
          if (uiDirectionFilter === 'out' && !isOut) return false;
          if (uiDirectionFilter === 'in' && isOut) return false;
      }
      
      // Stablecoin Filter
      if (filters.stablecoinsOnly) {
          const symbol = item.token_symbol || 'Native';
          if (!symbol || !STABLECOINS.includes(symbol.toUpperCase())) return false;
      }

      return true;
  });

  // EXPORT LOGIC
  const getNormalizedData = () => {
    if (singleTx && type === 'tx') {
        const tx = singleTx;
        const isSuccess = tx.receipt_status === '1';
        const nativeValStr = formatCryptoValue(tx.value, 18);
        const nativeValNum = parseToFloat(nativeValStr);
        
        const gasUsed = BigInt(tx.receipt_gas_used || '0');
        const gasPrice = BigInt(tx.gas_price || '0');
        const feeNativeStr = formatCryptoValue((gasUsed * gasPrice).toString(), 18);
        const feeNativeNum = parseToFloat(feeNativeStr);
        const feeUsd = nativePrice > 0 ? feeNativeNum * nativePrice : 0;

        let actionValueStr = nativeValStr;
        let actionSymbol = 'Native';
        let actionUsd = nativePrice > 0 ? nativeValNum * nativePrice : 0;

        if (erc20Transfers.length > 0) {
            const t = erc20Transfers[0];
            actionValueStr = formatCryptoValue(t.value, t.token_decimals);
            const actionValNum = parseToFloat(actionValueStr);
            actionSymbol = t.token_symbol || 'Unknown';
            if (tokenPrice > 0) {
                actionUsd = actionValNum * tokenPrice;
            } else if (['USDT', 'USDC', 'BUSD', 'DAI'].includes(actionSymbol.toUpperCase())) {
                actionUsd = actionValNum; 
            }
        } 

        return [{
            "Network": chainName,
            "Transaction Hash": tx.hash,
            "Status": isSuccess ? "Success" : "Fail",
            "Block": tx.block_number,
            "Date": new Date(tx.block_timestamp).toLocaleString(),
            "Timestamp": tx.block_timestamp,
            "From": tx.from_address,
            "To": tx.to_address || tx.receipt_contract_address || "Contract Creation",
            "Value": actionValueStr,
            "Symbol": actionSymbol,
            "Value (USD)": actionUsd > 0 ? actionUsd.toFixed(2) : "0.00",
            "Transaction Fee (Native)": feeNativeStr,
            "Transaction Fee (USD)": feeUsd > 0 ? feeUsd.toFixed(2) : "0.00",
            "Data Source": providerName || "API",
            "NFT Transfers": nftTransfers.length
        }];
    }

    return filteredItems.map(item => {
        const isNativeTx = type === 'tx';
        const decimals = isNativeTx ? parseInt(item.token_decimals || '18') : 18;
        const symbol = isNativeTx ? (item.token_symbol || 'Native') : item.token_symbol;
        const chain = item._chain || item._detected_chain || chainName;
        const currentPrice = priceMap[chain] || nativePrice; 
        
        const valStr = formatCryptoValue(item.value, decimals);
        const valNum = parseToFloat(valStr);
        const usdValue = (isNativeTx && currentPrice > 0 && symbol === 'Native') 
            ? valNum * currentPrice 
            : null;

        return {
            "Network": chain,
            "Hash": item.hash || item.transaction_hash,
            "Date": new Date(item.block_timestamp).toLocaleString(),
            "From": item.from_address,
            "To": item.to_address,
            "Value": valStr,
            "Symbol": symbol,
            "Value (USD)": usdValue !== null ? usdValue.toFixed(2) : ""
        };
    });
  };

  const handleDownloadJSON = () => {
    const dataToExport = getNormalizedData();
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chain_data_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadCSV = () => {
    const exportItems = getNormalizedData();
    if (exportItems.length === 0) return;

    const headers = Object.keys(exportItems[0]);
    const csvRows = [
        headers.join(","),
        ...exportItems.map(row => 
            headers.map(fieldName => {
                const val = (row as any)[fieldName] !== undefined ? (row as any)[fieldName] : "";
                const stringVal = String(val).replace(/"/g, '""');
                return `"${stringVal}"`;
            }).join(",")
        )
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chain_data_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (items.length === 0) return <div className="text-gray-500 italic">No data found.</div>;

  const DownloadButtons = () => (
      <div className="flex items-center gap-2">
          <button 
            onClick={handleDownloadCSV}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-medium text-slate-400 transition-colors border border-slate-700"
            title="Download CSV"
          >
             <DownloadIcon /> CSV
          </button>
          <button 
            onClick={handleDownloadJSON}
            className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-medium text-slate-400 transition-colors border border-slate-700"
            title="Download JSON"
          >
             <JsonIcon /> JSON
          </button>
      </div>
  );

  // === VIEW MODE: SINGLE TRANSACTION ===
  if (singleTx && type === 'tx') {
      const tx = singleTx;
      const isSuccess = tx.receipt_status === '1';
      
      const nativeValStr = formatCryptoValue(tx.value, 18);
      const nativeValNum = parseToFloat(nativeValStr);

      const gasUsed = BigInt(tx.receipt_gas_used || 0);
      const gasPrice = BigInt(tx.gas_price || 0);
      const feeNativeStr = formatCryptoValue((gasUsed * gasPrice).toString(), 18);
      const feeNativeNum = parseToFloat(feeNativeStr);
      const feeUsd = nativePrice > 0 ? feeNativeNum * nativePrice : 0;
      
      const relativeTime = getRelativeTime(tx.block_timestamp);
      const fullDate = new Date(tx.block_timestamp).toLocaleString('en-US', { 
        month: 'short', day: '2-digit', year: 'numeric', hour: 'numeric', minute: 'numeric', timeZoneName: 'short' 
      });

      let actionType = 'Call';
      let actionValueStr = '0';
      let actionSymbol = 'Native';
      let actionUsd = 0;
      let actionFrom = tx.from_address;
      let actionTo = tx.to_address;
      let isNFTAction = false;

      // Determine "Main Action" logic
      if (erc20Transfers.length > 0) {
          actionType = 'Transfer';
          const t = erc20Transfers[0];
          actionValueStr = formatCryptoValue(t.value, t.token_decimals);
          const actionValNum = parseToFloat(actionValueStr);
          actionSymbol = t.token_symbol || 'Unknown';
          actionFrom = t.from_address;
          actionTo = t.to_address;
          
          if (tokenPrice > 0) {
            actionUsd = actionValNum * tokenPrice;
          } else if (['USDT', 'USDC', 'BUSD', 'DAI'].includes(actionSymbol.toUpperCase())) {
            actionUsd = actionValNum; 
          }
      } else if (nftTransfers.length > 0) {
          isNFTAction = true;
          actionType = 'NFT Transfer';
          const nft = nftTransfers[0];
          actionSymbol = nft.token_symbol || nft.contract_type || 'NFT';
          actionValueStr = `ID: ${nft.token_id}`;
          actionFrom = nft.from_address || tx.from_address;
          actionTo = nft.to_address || tx.to_address;
      } else if (internalTransfers.length > 0) {
          actionType = 'Transfer (Internal)';
          const t = internalTransfers[0];
          actionValueStr = formatCryptoValue(t.value, 18);
          const actionValNum = parseToFloat(actionValueStr);
          actionSymbol = 'Native'; 
          actionUsd = nativePrice > 0 ? actionValNum * nativePrice : 0;
          actionFrom = t.from;
          actionTo = t.to;
      } else if (nativeValNum > 0) {
          actionType = 'Transfer';
          actionValueStr = nativeValStr;
          actionSymbol = 'Native';
          actionUsd = nativePrice > 0 ? nativeValNum * nativePrice : 0;
      }

      const isStableLike = ['USD', 'DAI', 'USDT', 'USDC'].some(s => actionSymbol.toUpperCase().includes(s));
      const displayActionValue = isNFTAction ? actionValueStr : formatDisplayNumber(actionValueStr, isStableLike);

      return (
        <div className="w-full mt-8 relative">
            <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 z-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-slate-900 ${isSuccess ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {isSuccess ? <CheckIcon /> : <XIcon />}
                </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900 shadow-xl overflow-hidden pt-8">
                <div className="text-center mb-6 px-4">
                    <h2 className="text-lg font-bold text-slate-100">
                        {isSuccess ? 'Successful Transaction' : 'Failed Transaction'}
                    </h2>
                    <div className="text-sm text-slate-400 mt-1 font-medium">
                        {relativeTime} <span className="text-slate-600 font-normal">({fullDate})</span>
                    </div>
                </div>

                <div className="px-6 pb-6">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        TRANSACTION ACTION <BoltIcon />
                    </div>
                    <div className="text-slate-300 text-sm leading-relaxed font-normal">
                         <span className="text-slate-400 capitalize">{actionType}</span>{' '}
                         <span className="font-bold text-slate-100">{displayActionValue}</span>{' '}
                         {actionSymbol !== 'Native' && (
                             <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 border border-slate-700 text-cyan-300 font-bold mx-0.5">
                                 {actionSymbol}
                             </span>
                         )}
                         {actionUsd > 0 && <span className="text-slate-400 font-medium ml-1">({formatCurrency(actionUsd)})</span>}
                         {' '}to{' '}
                         <span className="inline-flex align-middle mx-0.5"><Identicon address={actionTo} /></span>
                         <span className="font-mono text-cyan-400 hover:underline cursor-pointer" title={actionTo}>{truncate(actionTo, 8)}</span>
                         {' '}from{' '}
                         <span className="inline-flex align-middle mx-0.5"><Identicon address={actionFrom} /></span>
                         <span className="font-mono text-cyan-400 hover:underline cursor-pointer" title={actionFrom}>{truncate(actionFrom, 8)}</span>
                    </div>
                </div>

                <div className="px-6 pb-6 space-y-5">
                    <div>
                        <div className="flex items-center gap-2 mb-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            TRANSACTION HASH 
                        </div>
                        <div className="font-mono text-sm text-slate-200 break-all select-all">
                            {tx.hash}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                             <div className="flex items-center gap-2 mb-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                FROM (SENDER)
                             </div>
                             <div className="flex items-center gap-2">
                                <Identicon address={tx.from_address} />
                                <span className="font-mono text-sm text-cyan-400 hover:underline cursor-pointer">
                                    {truncate(tx.from_address, 12)}
                                </span>
                             </div>
                        </div>
                        <div>
                             <div className="flex items-center gap-2 mb-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                TO (RECEIVER)
                             </div>
                             <div className="flex items-center gap-2">
                                <Identicon address={tx.to_address || tx.receipt_contract_address} />
                                <div className="flex flex-col">
                                    <span className="font-mono text-sm text-cyan-400 hover:underline cursor-pointer">
                                        {truncate(tx.to_address || tx.receipt_contract_address || 'Contract Creation', 12)}
                                    </span>
                                </div>
                             </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <div className="flex items-center gap-2 mb-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                VALUE
                            </div>
                            <div className="text-sm text-slate-200 font-medium flex items-center gap-2 flex-wrap">
                                {actionSymbol !== 'Native' && (
                                    <span className="bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 text-xs">
                                        {actionSymbol}
                                    </span>
                                )}
                                <span>{displayActionValue}</span>
                                {actionSymbol === 'Native' && <span className="text-xs text-slate-500">Native</span>}
                                {actionUsd > 0 && <span className="text-slate-500 text-xs font-normal">({formatCurrency(actionUsd)})</span>}
                            </div>
                         </div>

                         <div>
                            <div className="flex items-center gap-2 mb-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                TRANSACTION FEE
                            </div>
                            <div className="text-sm text-slate-200 font-medium">
                                {feeUsd > 0 ? formatCurrency(feeUsd) : `${feeNativeStr} Native`}
                                {feeUsd > 0 && <span className="text-slate-500 text-xs font-normal ml-2">({feeNativeStr} Native)</span>}
                            </div>
                         </div>
                    </div>
                    
                    <div className="pt-2 flex justify-between items-end">
                        <div className="flex flex-col gap-1">
                             <div className="text-[10px] text-slate-600 font-mono uppercase">
                                Block: {BigInt(tx.block_number || '0').toString()}
                             </div>
                             {providerName === 'Public RPC' && (
                                <div className="px-2 py-0.5 w-fit rounded bg-amber-900/20 border border-amber-900/50 text-amber-500 text-[10px] font-bold uppercase">
                                    Source: Public RPC
                                </div>
                             )}
                        </div>
                        <DownloadButtons />
                    </div>

                </div>

                <div className="bg-slate-800/50 border-t border-slate-700/50 py-3 px-6 text-center">
                    <a 
                        href={`https://blockscan.com/tx/${tx.hash}`} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wide"
                    >
                        View on Blockscan <LinkIcon />
                    </a>
                </div>
            </div>

            {/* NFT Transfers Section */}
            {nftTransfers.length > 0 && (
                 <div className="mt-4 px-2">
                     <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-500 mb-2 pl-2">
                        <ImageIcon /> NFT Transfers ({nftTransfers.length})
                     </div>
                     <div className="bg-slate-900/50 rounded border border-slate-800 p-2 space-y-2">
                         {nftTransfers.map((nft, idx) => (
                             <div key={idx} className="flex justify-between items-center text-xs text-slate-300 font-mono p-1 hover:bg-slate-800/50 rounded">
                                 <div className="flex flex-col gap-0.5">
                                     <span className="text-cyan-400">
                                         {nft.token_name || nft.token_symbol || 'Unknown Collection'} 
                                         <span className="text-slate-500 ml-1">({nft.contract_type})</span>
                                     </span>
                                     <span className="text-[10px] text-slate-500">ID: {truncate(nft.token_id, 12)}</span>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <span className="text-slate-500">{truncate(nft.from_address || '', 6)} &rarr; {truncate(nft.to_address || '', 6)}</span>
                                     {nft.amount && parseInt(nft.amount) > 1 && (
                                         <span className="px-1.5 py-0.5 bg-slate-700 rounded text-[10px]">x{nft.amount}</span>
                                     )}
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
            )}

            {internalTransfers.length > 0 && (
                 <div className="mt-4 px-2">
                     <div className="text-[10px] uppercase font-bold text-slate-500 mb-2 pl-2">Internal Transfers</div>
                     <div className="bg-slate-900/50 rounded border border-slate-800 p-2 space-y-1">
                         {internalTransfers.map((it, idx) => (
                             <div key={idx} className="flex justify-between text-xs text-slate-400 font-mono">
                                 <span>{truncate(it.from, 6)} &rarr; {truncate(it.to, 6)}</span>
                                 <span>{formatCryptoValue(it.value, 18)} Native</span>
                             </div>
                         ))}
                     </div>
                 </div>
            )}
        </div>
      );
  }

  // === VIEW MODE: LIST / TABLE (BLOCKSCAN STYLE) ===
  return (
    <div className="w-full mt-4 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 shadow-sm animate-fade-in-up">
      <div className="bg-slate-900 px-4 py-3 text-sm font-bold text-slate-200 border-b border-slate-800 flex justify-between items-center flex-wrap gap-2">
           <div className="flex flex-col gap-0.5">
               <div className="flex items-center gap-2">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Transactions ({filteredItems.length})
                  </span>
                  <span className="text-xs font-normal text-slate-500 px-2 py-0.5 rounded bg-slate-800 border border-slate-700 whitespace-nowrap">
                      {chainName || 'Unknown Chain'}
                  </span>
               </div>
               <div className="text-[10px] font-normal text-slate-400 flex items-center gap-1 flex-wrap">
                   {(filters.from || filters.to) && <span>📅 {filters.from || '...'} - {filters.to || '...'}</span>}
                   {filters.stablecoinsOnly && <span className="text-cyan-400 font-bold ml-1">Example: Stablecoins Only</span>}
               </div>
           </div>

           <div className="flex items-center gap-2">
               {/* Direction Filter Dropdown */}
               <div className="flex bg-slate-800 rounded p-0.5 border border-slate-700">
                    <button 
                        onClick={() => setUiDirectionFilter('all')}
                        className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${uiDirectionFilter === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        ALL
                    </button>
                    <button 
                        onClick={() => setUiDirectionFilter('in')}
                        className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${uiDirectionFilter === 'in' ? 'bg-green-900/50 text-green-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        IN
                    </button>
                    <button 
                        onClick={() => setUiDirectionFilter('out')}
                        className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${uiDirectionFilter === 'out' ? 'bg-amber-900/50 text-amber-400' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                        OUT
                    </button>
               </div>
               <DownloadButtons />
           </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/50 text-xs font-bold text-slate-400 border-b border-slate-700">
            <tr>
              <th className="px-4 py-3 w-[140px]">Tx Hash</th>
              <th className="px-4 py-3 w-[100px]">Method</th>
              <th className="px-4 py-3 w-[100px]">Block</th>
              <th className="px-4 py-3 w-[100px] text-blue-400">Age</th>
              <th className="px-4 py-3 w-[180px]">From</th>
              <th className="px-4 py-3 w-[180px]">To</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3 text-slate-500">Tx Fee</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {filteredItems.map((item: any, idx) => {
               const isNativeTx = type === 'tx';
               // Enriched data from Merge Strategy in geminiService might have populated 'token_symbol' even for native txs
               const symbol = item.token_symbol || (isNativeTx ? 'Native' : 'Unknown');
               const decimals = item.token_decimals ? parseInt(item.token_decimals) : 18;
               
               const chain = item._chain || item._detected_chain || chainName;
               const currentPrice = priceMap[chain] || nativePrice;

               const valStr = formatCryptoValue(item.value, decimals);
               const displayVal = formatDisplayNumber(valStr);
               const valNum = parseToFloat(valStr);
               
               // Only Calculate USD if we have price AND (it's native OR it's a known stablecoin/token)
               // Simple logic: If symbol is Native, use Native Price. 
               let usdValue = null;
               if (symbol === 'Native' && currentPrice > 0) {
                   usdValue = valNum * currentPrice;
               } else if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(symbol.toUpperCase())) {
                   usdValue = valNum; // Approx 1:1 for stables
               }

               const method = getMethod(item.input, item.to_address, item.from_address, item.value);
               const relativeTime = getRelativeTime(item.block_timestamp);

               // Fee Calculation
               const gasUsed = BigInt(item.receipt_gas_used || item.gas_used || '0');
               const gasPrice = BigInt(item.gas_price || '0');
               const feeNativeStr = formatCryptoValue((gasUsed * gasPrice).toString(), 18);
               const feeNativeNum = parseToFloat(feeNativeStr);
               
               // In/Out Logic
               const isOut = searchedAddress && item.from_address && item.from_address.toLowerCase() === searchedAddress;
               const isIn = searchedAddress && !isOut; // Simplified

               return (
                  <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                    {/* Hash */}
                    <td className="px-4 py-4 font-mono text-cyan-400">
                      <a href={`https://blockscan.com/tx/${item.hash || item.transaction_hash}`} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1 truncate w-[100px]">
                        <FileIcon /> {truncate(item.hash || item.transaction_hash || '', 10)}
                      </a>
                    </td>

                    {/* Method */}
                    <td className="px-4 py-4">
                        <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300 truncate max-w-[90px] block text-center" title={method}>
                            {method}
                        </span>
                    </td>

                    {/* Block */}
                    <td className="px-4 py-4 text-xs text-blue-400 font-mono">
                         {item.block_number}
                    </td>

                    {/* Age */}
                    <td className="px-4 py-4 text-xs text-slate-400 whitespace-nowrap">
                         {relativeTime}
                    </td>

                    {/* From */}
                    <td className="px-4 py-4">
                        <div className="flex items-center justify-between gap-2 max-w-[160px]">
                            <div className="flex items-center gap-1.5 truncate">
                                {isOut ? <span className="text-xs text-slate-500">Create</span> : <LinkIcon />}
                                <span className="font-mono text-cyan-400 text-xs hover:underline cursor-pointer" title={item.from_address}>
                                    {truncate(item.from_address, 8)}
                                </span>
                            </div>
                            {isIn && <span className="px-1.5 py-0.5 rounded bg-green-900/30 border border-green-800 text-green-500 text-[9px] font-bold uppercase">IN</span>}
                        </div>
                    </td>

                    {/* To */}
                    <td className="px-4 py-4">
                         <div className="flex items-center justify-between gap-2 max-w-[160px]">
                            <div className="flex items-center gap-1.5 truncate">
                                <LinkIcon />
                                <span className="font-mono text-cyan-400 text-xs hover:underline cursor-pointer" title={item.to_address}>
                                    {truncate(item.to_address || item.receipt_contract_address || 'Contract', 8)}
                                </span>
                            </div>
                            {isOut && <span className="px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-800 text-amber-500 text-[9px] font-bold uppercase">OUT</span>}
                        </div>
                    </td>

                    {/* Value */}
                    <td className="px-4 py-4 text-xs">
                       <div className="font-medium text-slate-200 flex flex-col">
                         <span className={symbol !== 'Native' ? 'text-cyan-300 font-bold' : ''}>{displayVal} {symbol}</span>
                         {usdValue !== null && usdValue > 0 && (
                             <span className="text-slate-500 text-[10px]">({formatCurrency(usdValue)})</span>
                         )}
                       </div>
                    </td>

                    {/* Fee */}
                    <td className="px-4 py-4 text-xs text-slate-500">
                        {feeNativeNum > 0 ? parseFloat(feeNativeStr).toFixed(5) : '0'}
                    </td>
                  </tr>
               );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};