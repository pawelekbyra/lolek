'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import PlaceholderToolCard from './PlaceholderToolCard';

const LolekChat = () => {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sessionId] = useState(uuidv4());
  const { messages, sendMessage, setMessages, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/lolek',
      body: { session_id: sessionId },
    }),
  });

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
      setFile(file);
    }
  };


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() && !file) return;

    const messageParts = [{ type: 'text', text: input }];

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        sendMessage({
          parts: [
            ...messageParts,
            { type: 'file', mimeType: file.type, data: base64Data },
          ],
        });
      };
      reader.readAsDataURL(file);
    } else {
      sendMessage({ parts: messageParts });
    }

    setInput('');
    setFile(null);
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-2 rounded-lg shadow-md ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}>
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  return <p key={i}>{part.text}</p>;
                }
                if (part.type === 'tool-invocation') {
                  return <PlaceholderToolCard key={i} toolCall={part} />;
                }
              })}
            </div>
          </div>
        ))}
      </div>
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t bg-white flex items-center"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Type a message or upload an image..."
          disabled={status !== 'ready'}
        />
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="ml-2 px-4 py-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 disabled:opacity-50"
          disabled={status !== 'ready'}
        >
          Upload
        </button>
        <button
          type="submit"
          className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          disabled={(!input.trim() && !file) || status !== 'ready'}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default LolekChat;
