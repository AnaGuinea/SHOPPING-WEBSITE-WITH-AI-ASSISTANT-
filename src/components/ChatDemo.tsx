import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, ExternalLink, Crown, Lock } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { useToast } from "@/hooks/use-toast";
import { useChatState } from "@/hooks/useChatState";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import WishlistButton from "./WishlistButton";

interface Message {
  role: "user" | "assistant";
  content: string;
}

// Parse message content to extract images and links
const parseMessageContent = (content: string) => {
  const links: { url: string; title?: string; price?: string; image?: string }[] = [];
  
  // Extract product blocks - each product has an image, link, price, etc.
  // Pattern: Look for markdown links and their surrounding context
  const lines = content.split('\n');
  let currentImage: string | null = null;
  let currentPrice: string | null = null;
  
  // First pass: extract all images with their context
  const imageMap: { [key: number]: string } = {};
  lines.forEach((line, idx) => {
    const imagePatterns = [
      /🖼️\s*Imagine:\s*(https?:\/\/[^\s\n\)]+)/i,
      /Imagine:\s*(https?:\/\/[^\s\n\)]+)/i,
      /\*\*Imagine\*\*:\s*(https?:\/\/[^\s\n]+)/i,
    ];
    
    for (const pattern of imagePatterns) {
      const match = line.match(pattern);
      if (match) {
        const url = match[1].replace(/[)\]]+$/, '');
        imageMap[idx] = url;
        break;
      }
    }
  });
  
  // Second pass: extract links and associate with nearby images
  lines.forEach((line, idx) => {
    // Check for price in current or nearby lines
    const priceMatch = line.match(/(?:💰\s*)?Pre[țt]:\s*([0-9.,]+\s*(?:RON|Lei|EUR|€)?)/i);
    if (priceMatch) {
      currentPrice = priceMatch[1];
    }
    
    // Check for image in current or previous lines (within 3 lines)
    for (let i = idx; i >= Math.max(0, idx - 4); i--) {
      if (imageMap[i]) {
        currentImage = imageMap[i];
        break;
      }
    }
    
    // Find markdown links [title](url)
    const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g;
    let match;
    while ((match = markdownLinkRegex.exec(line)) !== null) {
      if (!match[2].match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)) {
        links.push({ 
          title: match[1], 
          url: match[2],
          price: currentPrice || undefined,
          image: currentImage || undefined
        });
        // Reset for next product
        currentImage = null;
        currentPrice = null;
      }
    }
    
    // Also find Link: format or 🔗 Link: format
    const linkFormatRegex = /(?:🔗\s*)?Link:\s*(https?:\/\/[^\s\n]+)/gi;
    while ((match = linkFormatRegex.exec(line)) !== null) {
      const url = match[1];
      if (!links.find(l => l.url === url)) {
        links.push({ 
          url, 
          title: undefined,
          price: currentPrice || undefined,
          image: currentImage || undefined
        });
        currentImage = null;
        currentPrice = null;
      }
    }
  });
  
  // Clean up content for display - remove image lines since we show them visually
  let cleanContent = content
    .replace(/🖼️\s*Imagine:\s*https?:\/\/[^\s\n]+/gi, '')
    .replace(/Imagine:\s*https?:\/\/[^\s\n]+/gi, '')
    .replace(/\*\*Imagine\*\*:\s*https?:\/\/[^\s\n]+/gi, '')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
  
  return { cleanContent, links };
};

const initialMessages: Message[] = [
  {
    role: "assistant",
    content: "Bună! Sunt agentul tău de comerț local. 🛒 Spune-mi ce cauți și îți voi găsi cele mai bune opțiuni de la afaceri mici și locale din România.",
  },
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

const ChatDemo = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const shouldScrollRef = useRef(false);
  const { toast } = useToast();
  const { pendingQuery, clearPendingQuery } = useChatState();
  const { user, session } = useAuth();
  const { canSendMessage, remainingMessages, isSubscribed, refreshMessageCount, openCheckout } = useSubscription();
  const navigate = useNavigate();

  // Only scroll when user sends a message, not during AI streaming
  useEffect(() => {
    if (shouldScrollRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      shouldScrollRef.current = false;
    }
  }, [messages]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!messageText.trim() || isLoading) return;
    
    // Check if user can send messages
    if (!canSendMessage) {
      toast({
        title: "Limită atinsă",
        description: "Ai folosit toate mesajele gratuite de azi. Fă upgrade la Pro pentru acces nelimitat!",
        variant: "destructive",
      });
      return;
    }
    
    // Server-side rate limiting handles the count increment

    const userMessage: Message = { role: "user", content: messageText };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    shouldScrollRef.current = true;

    try {
      // Include auth token for server-side rate limiting
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: newMessages.slice(1) }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Eroare la conectare");
      }

      if (!response.body) throw new Error("Nu s-a primit răspuns");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && prev.length > 1) {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
      // Refresh message count after successful send
      if (!isSubscribed) {
        refreshMessageCount();
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast({
        title: "Eroare",
        description: error instanceof Error ? error.message : "Nu s-a putut trimite mesajul",
        variant: "destructive",
      });
    }
  }, [messages, isLoading, toast, canSendMessage, isSubscribed, refreshMessageCount]);

  // Listen for pending queries from hero search
  useEffect(() => {
    if (pendingQuery && !isLoading) {
      setIsLoading(true);
      sendMessage(pendingQuery).finally(() => {
        setIsLoading(false);
        clearPendingQuery();
      });
    }
  }, [pendingQuery, isLoading, sendMessage, clearPendingQuery]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    setIsLoading(true);
    await sendMessage(input);
    setIsLoading(false);
  };

  const handleUpgradeClick = () => {
    if (!user) {
      navigate("/auth");
    } else {
      openCheckout();
    }
  };

  return (
    <section id="demo" className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4">
            Încearcă Agentul
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto font-body">
            Conversează cu agentul nostru AI și descoperă produse locale
          </p>
        </div>

        <Card variant="chat" className="max-w-3xl mx-auto">
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-heading font-semibold text-foreground">LocalAgent AI</h3>
              <p className="text-xs text-muted-foreground font-body">Conectat • Powered by AI</p>
            </div>
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="h-96 overflow-y-auto p-4 space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${message.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === "user" ? "bg-secondary" : "bg-primary"
                  }`}
                >
                  {message.role === "user" ? (
                    <User className="w-4 h-4 text-secondary-foreground" />
                  ) : (
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] p-4 rounded-2xl font-body text-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-card border border-border text-foreground rounded-tl-sm"
                  }`}
                >
                  {message.role === "assistant" ? (
                    (() => {
                      const { cleanContent, links } = parseMessageContent(message.content);
                      return (
                        <div className="space-y-3">
                          <div className="whitespace-pre-wrap">{cleanContent}</div>
                          
                          
                          {links.length > 0 && (
                            <div className="space-y-2 mt-2">
                              {links.slice(0, 3).map((link, linkIdx) => (
                                <div key={linkIdx} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                                  {link.image && (
                                    <img
                                      src={link.image}
                                      alt={link.title || 'Produs'}
                                      className="w-12 h-12 object-cover rounded-md border border-border flex-shrink-0"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                      }}
                                    />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <a
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs font-medium text-foreground hover:text-primary transition-colors line-clamp-1"
                                    >
                                      {(link.title || 'Produs').slice(0, 50)}{(link.title || 'Produs').length > 50 ? '...' : ''}
                                    </a>
                                    {link.price && (
                                      <p className="text-xs text-primary font-semibold">{link.price}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <a
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                                    >
                                      <ExternalLink className="w-4 h-4" />
                                    </a>
                                    <WishlistButton 
                                      url={link.url} 
                                      title={link.title}
                                      price={link.price}
                                      image={link.image}
                                      className="h-7 w-7"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  )}
                </div>
              </div>
            ))}

            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary-foreground" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm p-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            {!canSendMessage ? (
              <div className="bg-muted/50 rounded-xl p-4 text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Lock className="w-5 h-5" />
                  <span className="font-body">Ai folosit toate cele 3 mesaje gratuite de azi</span>
                </div>
                <Button onClick={handleUpgradeClick} className="gap-2">
                  <Crown className="w-4 h-4" />
                  {user ? "Upgrade la Pro - 1€/lună" : "Autentifică-te pentru upgrade"}
                </Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Input
                    variant="search"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Scrie un mesaj..."
                    className="pr-12"
                  />
                  <Button
                    variant="chat"
                    size="icon"
                    onClick={handleSend}
                    disabled={isLoading}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground font-body">
                    Încearcă: "tricou portocaliu de la un producător local" sau "miere de albine"
                  </p>
                  {!isSubscribed && user && (
                    <span className="text-xs text-muted-foreground font-body">
                      {remainingMessages} mesaje rămase azi
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
};

export default ChatDemo;
