'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { v4 as uuidv4 } from 'uuid';

const LolekChat = () => {
  const [sessionId] = useState(uuidv4());
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, append } = useChat({
    api: '/api/lolek',
    body: { session_id: sessionId },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      const response = await fetch(`/api/lolek/history?session_id=${sessionId}`);
      const history = await response.json();
      setMessages(history);
    };
    fetchHistory();
  }, [sessionId, setMessages]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        append({
          role: 'user',
          content: [
            { type: 'text', text: input },
            { type: 'image', image: base64String },
          ],
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-2 rounded-lg shadow-md ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}>
              {typeof msg.content === 'string'
                ? msg.content
                : (msg.content as any[]).map((part, i) =>
                    part.type === 'text' ? (
                      <p key={i}>{part.text}</p>
                    ) : (
                      <img key={i} src={part.image} alt="user upload" className="max-w-xs rounded-lg" />
                    )
                  )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-lg bg-white text-black shadow-md animate-pulse">
              Lolek is thinking...
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t bg-white flex items-center">
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Type a message or upload an image..."
          disabled={isLoading}
        />
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="ml-2 px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 disabled:opacity-50"
          disabled={isLoading}
        >
          Upload
        </button>
        <button
          type="submit"
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          disabled={isLoading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default LolekChat;
