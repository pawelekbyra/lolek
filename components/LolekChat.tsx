'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import PlaceholderToolCard from './PlaceholderToolCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Artifact } from '@/app/page';

type LolekChatProps = {
  onArtifactGenerated: (artifact: Omit<Artifact, 'id' | 'isVisible'>) => void;
};

const LolekChat = ({ onArtifactGenerated }: LolekChatProps) => {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sessionId] = useState(uuidv4());

  const { messages, setMessages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/lolek',
      body: { session_id: sessionId },
    }),
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === 'generate_canvas_content') {
        onArtifactGenerated(toolCall.args);
        return {
          // You can optionally return a UI component to render in place of the tool call
        };
      }
    },
    initialMessages: (async () => {
      const response = await fetch(`/api/lolek/history?session_id=${sessionId}`);
      return await response.json();
    })()
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
    }
  };

  const submitMessage = () => {
    if (!input.trim() && !file) return;

    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        sendMessage({
          parts: [
            { type: 'text', text: input },
            {
              type: 'file',
              mediaType: file.type,
              url: `data:${file.type};base64,${base64String.split(',')[1]}`,
            },
          ],
        });
      };
      reader.readAsDataURL(file);
    } else {
      sendMessage({
        parts: [{ type: 'text', text: input }],
      });
    }

    setInput('');
    setFile(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    submitMessage();
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-2 rounded-lg shadow-md ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}>
              {message.parts.map((part, i) => {
                if (part.type === 'text') {
                  return (
                    <ReactMarkdown
                      key={i}
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code(props) {
                          const { children, className, ...rest } = props
                          const match = /language-(\w+)/.exec(className || '')
                          return match ? (
                            <SyntaxHighlighter
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code {...rest} className={className}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {part.text}
                    </ReactMarkdown>
                  );
                }
                if (part.type === 'tool-invocation') {
                  if (part.toolName === 'generate_canvas_content') {
                    // Don't render a placeholder for the canvas tool
                    return null;
                  }
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
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Type a message or upload an image..."
          disabled={status !== 'ready'}
          rows={3}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitMessage();
            }
          }}
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
