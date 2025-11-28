import React, { useState, useRef, useEffect } from 'react';
import { ChatBubble } from './components/ChatBubble';
import { Message, ChatState } from './types';
import { GeminiAgent } from './services/geminiService';

// Icons
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
);

const SettingsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
);

const CalendarIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);

// Fallback Keys (User Provided)
const DEFAULT_MORALIS_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjExZjBhNzQ0LTI4YTMtNGRiNy1iZWUzLWU3OWJkZmNkMjQ4ZiIsIm9yZ0lkIjoiNDc2NzQ2IiwidXNlcklkIjoiNDkwNDc1IiwidHlwZUlkIjoiNjhkZGE0ZjktMWE3ZS00OGM3LTgzNTQtOGVmNTMyYmMyY2EyIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjA5MDQwODksImV4cCI6NDkxNjY2NDA4OX0.EPHXjWEIUM6T6JS3w9jNf39b-H6kLcGK-jZHiVXtghE';
const DEFAULT_ETHERSCAN_KEY = 'SYN3PECWZ8EJK3X5AC4WFRGC1VJP9T24A3';

const App: React.FC = () => {
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilters, setDateFilters] = useState({ from: '', to: '' });
  const [directionFilter, setDirectionFilter] = useState<'all' | 'in' | 'out'>('all');
  const [stablecoinFilter, setStablecoinFilter] = useState(false);

  const [chatState, setChatState] = useState<ChatState>({
    messages: [{
        id: '1',
        role: 'model',
        content: 'Olá! Sou seu agente de blockchain. Posso analisar wallets, transações e tokens. Cole um endereço ou hash para começar. (Ex: "Mostre as últimas 5 transações de 0xd8dA...")',
        timestamp: Date.now()
    }],
    isLoading: false,
    // Prioritize Env, then Hardcoded Default, then Empty
    moralisApiKey: process.env.MORALIS_API_KEY || DEFAULT_MORALIS_KEY, 
    etherscanApiKey: process.env.ETHERSCAN_API_KEY || DEFAULT_ETHERSCAN_KEY 
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatState.messages]);

  const handleSend = async () => {
    // Only block if input is empty
    if (!input.trim()) return;

    let finalInput = input;
    const filterParts = [];
    
    if (dateFilters.from && dateFilters.to) filterParts.push(`from ${dateFilters.from} to ${dateFilters.to}`);
    else if (dateFilters.from) filterParts.push(`from ${dateFilters.from}`);
    
    if (directionFilter !== 'all') filterParts.push(`direction: ${directionFilter}`);
    if (stablecoinFilter) filterParts.push(`filter: stablecoins only`);

    if (filterParts.length > 0) {
        finalInput += ` (Filters: ${filterParts.join(', ')})`;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input, // Display pure input to user
      timestamp: Date.now()
    };

    setChatState(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      isLoading: true
    }));

    setInput('');
    setShowFilters(false); // Close filters after sending

    try {
      const agent = new GeminiAgent(chatState.moralisApiKey, chatState.etherscanApiKey);
      
      const responseId = (Date.now() + 1).toString();
      let toolData: any = null;
      let toolName: string = '';

      const textResponse = await agent.sendMessage(
        chatState.messages, 
        finalInput, // Send modified input to Agent
        (name, data) => {
             toolName = name;
             toolData = data;
        }
      );

      const botMsg: Message = {
        id: responseId,
        role: 'model',
        content: textResponse,
        timestamp: Date.now(),
        data: toolData,
        toolCallId: toolName
      };

      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, botMsg],
        isLoading: false
      }));

    } catch (error: any) {
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, {
            id: Date.now().toString(),
            role: 'model',
            content: `Error: ${error.message || "Failed to process request."}`,
            timestamp: Date.now()
        }],
        isLoading: false
      }));
    }
  };

  const hasActiveFilters = dateFilters.from || dateFilters.to || directionFilter !== 'all' || stablecoinFilter;
  const isKeysConfigured = chatState.moralisApiKey && chatState.moralisApiKey.length > 10;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-900 text-slate-100 relative overflow-hidden">
      
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 z-10"></div>
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/2 -right-20 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white">
                CA
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">ChainAgent <span className="text-blue-500">Explorer</span></h1>
        </div>
        <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 transition-colors hover:bg-slate-800 rounded-md ${!isKeysConfigured ? 'text-amber-500' : 'text-slate-400 hover:text-white'}`}
            title="Settings"
        >
            <SettingsIcon />
        </button>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
                <h2 className="text-xl font-bold mb-4">Settings</h2>
                <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        Moralis API Key 
                    </label>
                    <input 
                        type="password"
                        value={chatState.moralisApiKey}
                        onChange={(e) => setChatState(prev => ({ ...prev, moralisApiKey: e.target.value }))}
                        placeholder="Enter your Moralis Web3 API Key"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Optional. Required for multi-chain wallet history.
                    </p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                        Etherscan V2 API Key
                    </label>
                    <input 
                        type="password"
                        value={chatState.etherscanApiKey}
                        onChange={(e) => setChatState(prev => ({ ...prev, etherscanApiKey: e.target.value }))}
                        placeholder="Etherscan V2 (Multichain) API Key"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Optional. Use for enhanced Ethereum/BSC/Polygon data.
                    </p>
                </div>

                <div className="flex justify-end">
                    <button 
                        onClick={() => setShowSettings(false)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                    >
                        Save & Close
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Chat Area */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-10 scroll-smooth">
        <div className="max-w-4xl mx-auto">
            {chatState.messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
            ))}
            {chatState.isLoading && (
                <div className="flex justify-start mb-6 animate-pulse">
                    <div className="bg-slate-800/50 px-4 py-3 rounded-2xl rounded-bl-sm">
                        <div className="flex gap-1">
                            <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                            <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></span>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </main>

      {/* Input Area */}
      <footer className="p-4 border-t border-slate-800 bg-slate-900 z-20">
        <div className="max-w-4xl mx-auto relative flex flex-col gap-2">
            
            {/* Filter Popover */}
            {showFilters && (
                <div className="absolute bottom-full left-0 mb-3 bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl flex flex-col gap-3 animate-fade-in-up w-full sm:w-auto min-w-[200px] z-50">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase text-slate-500 font-bold">Direction</label>
                        <div className="flex gap-1 bg-slate-900 rounded p-1 border border-slate-700">
                             <button onClick={() => setDirectionFilter('all')} className={`flex-1 text-xs py-1 rounded ${directionFilter === 'all' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>All</button>
                             <button onClick={() => setDirectionFilter('in')} className={`flex-1 text-xs py-1 rounded ${directionFilter === 'in' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-white'}`}>In</button>
                             <button onClick={() => setDirectionFilter('out')} className={`flex-1 text-xs py-1 rounded ${directionFilter === 'out' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'}`}>Out</button>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[10px] uppercase text-slate-500 font-bold">From</label>
                            <input 
                                type="date" 
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 w-full"
                                value={dateFilters.from}
                                onChange={(e) => setDateFilters(prev => ({...prev, from: e.target.value}))}
                            />
                        </div>
                        <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[10px] uppercase text-slate-500 font-bold">To</label>
                            <input 
                                type="date" 
                                className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 w-full"
                                value={dateFilters.to}
                                onChange={(e) => setDateFilters(prev => ({...prev, to: e.target.value}))}
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-700/50 mt-1">
                         <input 
                            type="checkbox" 
                            id="stableFilter"
                            checked={stablecoinFilter}
                            onChange={(e) => setStablecoinFilter(e.target.checked)}
                            className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 accent-blue-600"
                         />
                         <label htmlFor="stableFilter" className="text-xs text-slate-300 cursor-pointer select-none">
                             Only Stablecoins (USDT, USDC...)
                         </label>
                    </div>

                    <button 
                        onClick={() => { setDateFilters({from: '', to: ''}); setDirectionFilter('all'); setStablecoinFilter(false); }}
                        className="text-xs text-slate-400 hover:text-white underline mt-1 text-center"
                    >
                        Clear Filters
                    </button>
                </div>
            )}

            <div className="relative flex items-center gap-2">
                <button 
                    onClick={() => setShowFilters(!showFilters)}
                    className={`p-3 rounded-xl border transition-all ${hasActiveFilters ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                    title="Filters (Date, Direction, Tokens)"
                >
                    <CalendarIcon />
                    {hasActiveFilters && <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
                </button>

                <div className="relative flex-1">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder={hasActiveFilters ? `Ask with active filters...` : "Ask about a wallet, transaction, or token..."}
                        className="w-full bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-700 rounded-xl py-3 pl-4 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-lg"
                        disabled={chatState.isLoading}
                    />
                    <button 
                        onClick={handleSend}
                        disabled={chatState.isLoading || !input.trim()}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <SendIcon />
                    </button>
                </div>
            </div>
            
            <div className="text-center text-xs text-slate-600">
                Powered by Gemini AI, Moralis & Etherscan V2 API
            </div>
        </div>
      </footer>
    </div>
  );
};

export default App;