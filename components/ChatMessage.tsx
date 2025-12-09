import React from 'react';
import { ChatMessage, MessageSender } from '../types';
import MarkdownRenderer from './MarkdownRenderer'; // Assuming you have a MarkdownRenderer component

interface ChatMessageProps {
  message: ChatMessage;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isManualito = message.sender === MessageSender.MANUALITO;

  return (
    <div
      className={`flex mb-4 ${isManualito ? 'justify-start' : 'justify-end'}`}
    >
      <div
        className={`max-w-[70%] px-4 py-2 rounded-lg shadow-md ${
          isManualito
            ? 'bg-red-700 text-white rounded-bl-none'
            : 'bg-indigo-100 text-gray-800 rounded-br-none'
        }`}
      >
        <div className="font-semibold mb-1">
          {isManualito ? 'Manualito' : 'Tú'}
        </div>
        <div className="text-sm">
          <MarkdownRenderer content={message.text} />
        </div>
        <div className="text-xs text-right opacity-75 mt-1">
          {message.timestamp}
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;