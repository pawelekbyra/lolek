'use client';

import { Artifact } from '@/app/page';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, UIMessage } from 'ai';
import { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import PlaceholderToolCard from './PlaceholderToolCard';
import ApprovalCard from './chat/ApprovalCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type LolekChatProps = {
  onArtifactGenerated: (artifact: Omit<Artifact, 'id' | 'isVisible'>) => void;
};

// Inner component that handles the actual chat interface and useChat hook
const ChatInterface = ({
  onArtifactGenerated,
  userId,
  sessionId
}: LolekChatProps & { userId: string, sessionId: string }) => {
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { messages, setMessages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/lolek',
      body: { session_id: sessionId, userId: userId },
    }),
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === 'generate_canvas_content') {
        onArtifactGenerated(toolCall.input as Omit<Artifact, 'id' | 'isVisible'>);
        // Return nothing to prevent the tool call from being rendered in the chat
        return;
      }
    },
  });

  useEffect(() => {
    const fetchHistory = async () => {
      // Pass userId if the history endpoint supports it, otherwise keep it simple
      const response = await fetch(`/api/lolek/history?session_id=${sessionId}`);
      const historyMessages = await response.json();
      setMessages(historyMessages);
    };
    fetchHistory();
  }, [sessionId, setMessages, userId]);

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
              url: base64String,
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

  const handleApproveTool = (toolName: string, args: any) => {
    // When approved, we ask the agent to proceed with confirmation
    // We send a user message that tells the agent to retry with confirm: true
    sendMessage({
      role: 'user',
      parts: [{
        type: 'text',
        text: `I approve the execution of ${toolName}. Please proceed with the action using the same parameters and confirm=true.`
      }]
    });
  };

  const handleRejectTool = (toolName: string) => {
    sendMessage({
        role: 'user',
        parts: [{
          type: 'text',
          text: `I reject the execution of ${toolName}. Do not proceed.`
        }]
    });
  };

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto bg-gray-50">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`px-4 py-2 rounded-lg shadow-md max-w-full overflow-hidden ${message.role === 'user' ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}>
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

                // Handle tool invocations
                const isTool = part.type.startsWith('tool-') || part.type === 'dynamic-tool';
                if (isTool) {
                    // Extract toolName
                    let toolName: string;
                    if (part.type === 'dynamic-tool') {
                        toolName = part.toolName;
                    } else {
                        // For static tools, type is `tool-{name}`
                        toolName = part.type.substring(5);
                    }

                    if (toolName === 'generate_canvas_content') {
                        // Don't render a placeholder for the canvas tool
                        return null;
                    }

                    // Check for approval requirement
                    if ('output' in part && part.output && typeof part.output === 'object') {
                        const result = part.output as any;
                         if (result !== null && 'status' in result && result.status === 'requires_approval') {
                             const args = result.args || ('input' in part ? part.input : {});

                             return (
                                 <ApprovalCard
                                   key={i}
                                   toolName={toolName}
                                   args={args}
                                   onApprove={() => handleApproveTool(toolName, args)}
                                   onReject={() => handleRejectTool(toolName)}
                                 />
                             );
                         }
                    }

                    return <PlaceholderToolCard key={i} toolCall={part as any} />;
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

// Wrapper component to handle userId initialization
const LolekChat = (props: LolekChatProps) => {
  const [sessionId] = useState(uuidv4());
  const [userId, setUserId] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Generate or retrieve userId from localStorage
    if (typeof window !== 'undefined') {
      let storedUserId = localStorage.getItem('lolek_user_id');
      if (!storedUserId) {
        storedUserId = uuidv4();
        localStorage.setItem('lolek_user_id', storedUserId);
      }
      setUserId(storedUserId);
      setIsInitialized(true);
    }
  }, []);

  if (!isInitialized || !userId) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-500">Initializing Lolek...</div>
      </div>
    );
  }

  return <ChatInterface {...props} userId={userId} sessionId={sessionId} />;
};

export default LolekChat;
