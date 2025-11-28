import React from 'react';
import { Message } from '../types';
import { TransactionCard } from './TransactionCard';

interface ChatBubbleProps {
  message: Message;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 group`}>
      <div className={`max-w-[85%] lg:max-w-[70%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        
        {/* Author Label */}
        <span className="text-xs text-slate-500 mb-1 ml-1 mr-1">
            {isUser ? 'You' : 'ChainAgent AI'}
        </span>

        {/* Message Content */}
        <div 
          className={`
            px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-md
            ${isUser 
              ? 'bg-blue-600 text-white rounded-br-sm' 
              : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-sm'
            }
          `}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Tool Data Visualization */}
        {!isUser && message.data && (
           <div className="mt-2 w-full animate-fade-in-up">
              <div className="text-xs uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                Blockchain Data Fetched
              </div>
              <TransactionCard 
                data={message.data} 
                type={message.toolCallId === 'get_token_transfers' ? 'token' : 'tx'} 
              />
           </div>
        )}
      </div>
    </div>
  );
};