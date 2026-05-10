import { useState, useEffect, useRef } from "react";
import "./App.css";

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  isSystem?: boolean;
}

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    connect();
    return () => ws.current?.close();
  }, []);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const connect = () => {
    ws.current = new WebSocket("ws://localhost:8080");
    
    ws.current.onopen = () => {
      setIsConnected(true);
      ws.current?.send(JSON.stringify({ type: "start_chat" }));
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      setTimeout(connect, 3000); // Reconnect loop
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "text" || data.type === "system") {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            text: data.payload,
            isUser: false,
            isSystem: data.type === "system"
          }]);
          setIsThinking(false);
        }
      } catch (e) {
        console.error(e);
      }
    };
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !ws.current) return;

    setMessages(prev => [...prev, { id: Date.now().toString(), text: input, isUser: true }]);
    ws.current.send(JSON.stringify({ type: "chat_message", payload: { message: input } }));
    setInput("");
    setIsThinking(true);
  };

  return (
    <div className="container">
      <header className="header">
        <h1>AZERCLAW <span className="status" style={{ backgroundColor: isConnected ? '#22c55e' : '#ef4444' }}></span></h1>
      </header>
      
      <main className="chat-window">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.isUser ? 'user' : (msg.isSystem ? 'system' : 'agent')}`}>
            {msg.text}
          </div>
        ))}
        {isThinking && <div className="message agent thinking">🔪 Plotting...</div>}
        <div ref={endOfMessagesRef} />
      </main>

      <form onSubmit={send} className="input-area">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter command..."
          disabled={!isConnected}
        />
        <button type="submit" disabled={!isConnected || !input.trim()}>SEND</button>
      </form>
    </div>
  );
}

export default App;
