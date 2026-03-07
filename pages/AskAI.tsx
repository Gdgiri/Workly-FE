import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import { MessageSquare, Send, Copy, RotateCcw, Sparkles, ChevronRight, AlertCircle, Bot } from 'lucide-react';
import api from '../utils/api';
import axios from 'axios';
import { useCurrency } from '../components/CurrencyContext';

interface Message {
    id: string;
    type: 'user' | 'ai';
    content: string;
    timestamp: Date;
}

const QUICK_ACTIONS = [
    { icon: '👥', label: 'Add Specialist', query: 'How do I add a new specialist?' },
    { icon: '💰', label: 'View Revenue', query: "Show me today's revenue" },
    { icon: '✂️', label: 'Top Services', query: 'What are my top services?' },
    { icon: '📦', label: 'Inventory', query: 'Help me manage inventory' },
    { icon: '🎁', label: 'Packages', query: 'How do I create a package?' },
    { icon: '📅', label: 'Workflow', query: 'Explain the appointment workflow' }
];

const SUGGESTIONS = [
    'How do I add a new specialist?',
    "Show me today's revenue",
    'What are my top services?',
    'Help me manage inventory',
    'How do I create a package?',
    'Explain the appointment workflow',
    'How to set up payment methods?',
    'How to create a new service?',
    'How to manage customer data?',
    'How to view sales reports?',
    'How to handle refunds?',
    'How to set working hours?',
    'How to manage appointments?',
    'How to track expenses?',
    'How to create vouchers?',
    'How to manage categories?'
];

const getAI_RESPONSES = (symbol: string) => ({
    'stylist': () => `👥 **Add New Specialist Guide**

Summary:
Add team members to your salon for appointment scheduling and revenue tracking

Steps:
1. Navigate to **Specialists** from the sidebar
2. Click **Add Specialist** button
3. Enter specialist name, phone, and email
4. Select specializations (Hair, Makeup, etc.)
5. Set working hours and days
6. Assign services/packages they provide
7. Click **Save** to activate

Insight:
Specialists appear automatically in appointment booking and sales attribution.

Next Action:
Need to assign services to this specialist?`,
    
    'revenue': (stats: any) => stats ?
        `📊 **Today's Business Revenue**

Summary:
• Revenue: **${symbol}${stats.todayRevenue}**
• Sales: **${stats.todaySalesCount} completed**
• Appointments: **${stats.todayAppointmentsCount}**

Next Action:
Want to see a service-wise or specialist-wise breakdown?` :
        `⚠️ Unable to fetch live data. Please check your Dashboard for revenue summary.`,
    
    'services': (stats: any) => stats?.topServices?.length > 0 ?
        `📊 **Top Performing Services (Last 30 Days)**

Summary:
${stats.topServices.slice(0, 5).map((s: any, i: number) => `${i + 1}. **${s.name}** – **${s.value} bookings**`).join('\n')}

Insight:
These services are driving your revenue. Consider bundling them into premium packages.

Next Action:
Want to create a package with these services?` :
        `⚠️ No completed sales in the last 30 days. Start booking services to see performance data.`,
    
    'inventory': (stats: any) => stats?.lowStockAlerts?.length > 0 ?
        `📊 **Inventory Status**

Summary:
⚠️ **${stats.lowStockAlerts.length} Low Stock Alert(s)**:
${stats.lowStockAlerts.map((i: any) => `- **${i.name}** (**${i.stock} left**)`).join('\n')}

Insight:
Reorder these items immediately to avoid service disruptions.

Next Action:
Go to **Inventory** to place orders?` :
        `📊 **Inventory Status**

Summary:
✅ **Healthy Stock Levels** across all items.

Insight:
All active products have strong inventory. No immediate action needed.

Next Action:
Want to review your inventory breakdown?`,
    
    'package': (stats: any) => {
        const activeCount = stats?.activePackages?.length || 0;
        const list = activeCount > 0 ?
            `**Current Packages (${activeCount})**:
${stats.activePackages.slice(0, 3).map((p: any) => `• **${p.name}** – **${symbol}${p.price}**`).join('\n')}\n\n` : "";

        return `ℹ️ **Package Creation Guide**

${list}Steps:
1. Navigate to **Packages** from sidebar
2. Click **Add Package** button
3. Enter name, description, and price
4. Set validity (days or 0 for unlimited)
5. Add services/products with quantities
6. Upload cover image (optional)
7. Click **Save** to publish

Next Action:
Need help selecting which services to bundle?`;
    },
    
    'appointment': (stats: any) => stats?.pendingRequestsCount > 0 ?
        `📊 **Pending Appointment Requests**

Summary:
**${stats.pendingRequestsCount} requests** awaiting confirmation

Steps:
1. Go to **Appointments** page
2. Filter for "Pending" status
3. Review customer details and availability
4. Confirm or reschedule
5. Click **Confirm** to finalize

Insight:
Quick action on pending requests improves customer satisfaction and revenue certainty.

Next Action:
Ready to review these pending bookings?` :
        `📅 **Appointment Management**

Summary:
Track all booking statuses and specialist schedules in one place

Steps:
1. Go to **Appointments** page
2. View bookings by status (Pending, Confirmed, Completed)
3. Manage schedules and specialist availability
4. Reschedule or cancel if needed
5. Mark as completed to update revenue

Insight:
Synchronized appointments prevent double-bookings and optimize specialist utilization.

Next Action:
Want to check specialist availability?`,
    
    'sales_details': (stats: any) => stats?.todayServices?.length > 0 ?
        `📊 **Today's Sales Breakdown**

Summary:
**${stats.todaySalesCount} transactions** | **${symbol}${stats.todayRevenue}** total revenue

Details:
${stats.todayServices.slice(0, 10).map((s: any) => `• **${s.customerName}** – **${symbol}${s.totalAmount}** (${s.status}) at ${new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`).join('\n')}

Insight:
${stats.todaySalesCount > 5 ? '✅ Strong sales activity today with consistent transactions.' : '⚠️ Below typical activity - consider promotions or reach out to customers.'}

Next Action:
Want to see which services are trending?` :
        `ℹ️ **No Sales Yet Today**

Summary:
0 transactions recorded

Action Items:
1. Complete a service transaction first
2. Process a payment through the system
3. View details after booking is finalized

Insight:
Sales data updates in real-time as services are completed.

Next Action:
Need guidance on scheduling your first appointment?`,
    
    'default': () => `🤖 **Your Business Co-Pilot**

I'm your intelligent operations assistant. I provide real-time insights and guidance for:

Quick Answers:
• 💰 Revenue & sales analytics
• 📅 Appointment scheduling & management
• 📦 Package & service creation
• 📊 Inventory & stock monitoring
• 👥 Specialist performance & availability

Example Questions:
✓ "What's today's revenue?"
✓ "Show me top services"
✓ "How do I create a package?"
✓ "Pending appointments?"
✓ "Inventory status?"

What would you like to explore first?`
});

const getAIResponse = (userMessage: any, stats: any, symbol: string): string => {
    const responses = getAI_RESPONSES(symbol);
    const messageStr = typeof userMessage === 'string' ? userMessage : (typeof userMessage === 'function' ? userMessage(stats) : String(userMessage));
    const lowerMessage = messageStr.toLowerCase();
    
    // Revenue queries
    if (lowerMessage.match(/revenue|earning|income|sales|profit|daily.*revenue|today.*money|cash|turnover/)) {
        return responses.revenue(stats);
    }
    
    // Service queries
    if (lowerMessage.match(/service|top.*service|best.*service|popular|performing|trending/)) {
        return responses.services(stats);
    }
    
    // Inventory/Stock queries
    if (lowerMessage.match(/inventory|stock|product|reorder|low.*stock|out.*stock|supplies/)) {
        return responses.inventory(stats);
    }
    
    // Package queries
    if (lowerMessage.match(/package|combo|bundle|offer|promotion|create.*package|add.*package/)) {
        return responses.package(stats);
    }
    
    // Appointment/Schedule queries
    if (lowerMessage.match(/appointment|booking|schedule|workflow|pending|request|confirm/)) {
        return responses.appointment(stats);
    }
    
    // Specialist/Staff queries
    if (lowerMessage.match(/specialist|staff|stylist|manager|employee|team|add.*staff|add.*specialist/)) {
        return responses.stylist();
    }
    
    // Sales details queries
    if (lowerMessage.match(/sales.*detail|transaction|receipt|today.*sale|completed.*sale|sale.*breakdown|customer.*transaction/)) {
        return responses.sales_details(stats);
    }
    
    // Default fallback
    return responses.default();
};

const StreamingMessage: React.FC<{ content: string; speed?: number }> = ({ content, speed = 8 }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < content.length) {
            const adjustedSpeed = content.length > 200 ? speed / 1.5 : speed;
            const timer = setTimeout(() => {
                setDisplayedText(prev => prev + content[currentIndex]);
                setCurrentIndex(prev => prev + 1);
            }, adjustedSpeed + (Math.random() * 5));
            return () => clearTimeout(timer);
        }
    }, [currentIndex, content, speed]);

    // Enhanced Markdown-lite formatter
    const formatContent = (text: string) => {
        // Handle ### Headers
        let processed = text.replace(/^###\s+(.*$)/gm, '<h3 class="ai-h3">$1</h3>');
        // Handle **Bold**
        processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        // Handle * Italic
        processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Handle Bullet Points
        processed = processed.replace(/^\s*[\-\•]\s+(.*$)/gm, '<li class="ai-li">$1</li>');
        // Handle Newlines for lists (wrap groups in <ul>)
        processed = processed.replace(/(<li.*<\/li>)+/g, '<ul class="ai-ul">$&</ul>');

        return <div dangerouslySetInnerHTML={{ __html: processed }} />;
    };

    return <div className="markdown-container">{formatContent(displayedText)}</div>;
};

export const AskAI: React.FC = () => {
    const { user } = useAuth();
    const { symbol } = useCurrency();
    const AI_RESPONSES = getAI_RESPONSES(symbol);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
    const [groqApiKey, setGroqApiKey] = useState<string | null>(null);
    const [dashboardStats, setDashboardStats] = useState<any>(null);
    const [isConfigLoading, setIsConfigLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch Groq API Key and Dashboard Stats on mount
    useEffect(() => {
        const fetchConfig = async () => {
            try {
                // Fetch Settings (for Groq Key)
                const settingsResponse = await api.get('/settings');
                const settingsData = settingsResponse.data;
                if (settingsData.apiIntegrations) {
                    const integrations = typeof settingsData.apiIntegrations === 'string'
                        ? JSON.parse(settingsData.apiIntegrations)
                        : settingsData.apiIntegrations;

                    const groq = integrations.find((i: any) => i.enabled && i.apiKey?.startsWith('gsk_'));
                    if (groq) {
                        setGroqApiKey(groq.apiKey);
                    }
                }

                // Fetch Dashboard Stats (for Business Context)
                const dashboardResponse = await api.get('/dashboard');
                if (dashboardResponse.data?.success) {
                    setDashboardStats(dashboardResponse.data.data);
                }
            } catch (error) {
                console.error('Failed to fetch AI configuration or stats:', error);
            } finally {
                setIsConfigLoading(false);
            }
        };
        fetchConfig();
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isTyping]);

    useEffect(() => {
        if (inputValue.trim().length > 0) {
            const filtered = SUGGESTIONS.filter(s =>
                s.toLowerCase().includes(inputValue.toLowerCase())
            ).slice(0, 5);
            setFilteredSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
            setSelectedSuggestionIndex(0);
        } else {
            setShowSuggestions(false);
            setFilteredSuggestions([]);
        }
    }, [inputValue]);

    const handleSendMessage = async (content?: any) => {
        let messageContent = "";
        if (typeof content === 'function') {
            messageContent = content(dashboardStats);
        } else if (typeof content === 'string') {
            messageContent = content;
        } else {
            messageContent = inputValue.trim();
        }

        if (!messageContent || typeof messageContent !== 'string') return;

        const userMessage: Message = {
            id: Date.now().toString(),
            type: 'user',
            content: messageContent,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setShowSuggestions(false);
        setIsTyping(true);

        // Fetch LATEST stats right before processing to ensure AI has current data
        let latestStats = dashboardStats;
        try {
            const dashboardResponse = await api.get('/dashboard');
            if (dashboardResponse.data?.success) {
                latestStats = dashboardResponse.data.data;
                setDashboardStats(latestStats);
            }
        } catch (error) {
            console.warn('Using existing stats for AI context due to fetch error:', error);
        }

        let responseText = '';

        if (groqApiKey) {
            try {
                // Prepare context from dashboard stats
                const businessContext = latestStats ? `
                Available Metrics for Today (${new Date().toLocaleDateString()}):
                - Revenue: ${symbol}${latestStats.todayRevenue}
                - Schedule/Appointment Count: ${latestStats.todayAppointmentsCount || 0}
                - Completed Sales Count: ${latestStats.todaySalesCount || 0}
                - Total Unique Customers: ${latestStats.totalCustomers}
                - Lifetime Business Earnings: ${symbol}${latestStats.totalEarnings}
                - Lifetime Business Expenses: ${symbol}${latestStats.totalExpenses}
                - This Month's Expenses: ${symbol}${latestStats.thisMonthExpenses || 0}
                - Today's Expenses: ${symbol}${latestStats.todayExpenses?.reduce((acc: number, e: any) => acc + e.amount, 0) || 0}
                - Today's Expense Breakdown (List these one by one):
${latestStats.todayExpenses?.map((e: any) => `                  * ${e.title} (${e.category}): ${symbol}${e.amount}`).join('\n') || 'No expenses today'}
                - Today's Individual Sales Details (List these one by one):
${latestStats.todayServices?.map((s: any) => `                  * ${s.customerName} (${symbol}${s.totalAmount})`).join('\n') || 'No sales today'}
                
                === MONTHLY BUSINESS REPORT (${new Date().toLocaleString('default', { month: 'long' })}) ===
                - Monthly Revenue: ${symbol}${latestStats.thisMonthRevenue || 0}
                - Monthly Transactions: ${latestStats.thisMonthSalesCount || 0}
                - Monthly Appointments: ${latestStats.thisMonthAppointmentsCount || 0}
                
                === CUSTOMER INTELLIGENCE ===
                - Top 5 Most Frequent Customers: ${latestStats.topCustomersByVisits?.map((c: any) => `${c.name} (${c.value} visits)`).join(', ') || 'N/A'}
                - Top 5 Highest Spenders: ${latestStats.topCustomersBySpend?.map((c: any) => `${c.name} (${symbol}${c.value})`).join(', ') || 'N/A'}

                === INVENTORY INTELLIGENCE ===
                - High Stock Items (>20 units): ${latestStats.highStockItems?.map((i: any) => `${i.name} (${i.stock})`).join(', ') || 'None'}
                - Most Expensive Items: ${latestStats.highPriceItems?.map((i: any) => `${i.name} (${symbol}${i.price})`).join(', ') || 'N/A'}
                - Least Expensive Items: ${latestStats.lowPriceItems?.map((i: any) => `${i.name} (${symbol}${i.price})`).join(', ') || 'N/A'}

                === OPERATIONS & STAFF ===
                - Available Specialists: ${latestStats.availableSpecialists?.map((s: any) => s.name).join(', ') || 'None listed'}
                - Daily Payment Reconciliation: ${Object.entries(latestStats.dailyReconciliation || {}).map(([method, amount]) => `${method}: ${symbol}${amount}`).join(', ') || 'No payments today'}
                - Monthly Payment Reconciliation: ${Object.entries(latestStats.monthlyReconciliation || {}).map(([method, amount]) => `${method}: ${symbol}${amount}`).join(', ') || 'No payments this month'}

                - PENDING Requests/Notifications: ${latestStats.pendingRequestsCount || 0}
                - Active Packages: ${latestStats.activePackages?.map((p: any) => `${p.name} (${symbol}${p.price})`).join(', ') || 'None available yet'}
                - Top Performing Services (Last 30 Days): ${latestStats.topServices?.map((s: any) => `${s.name} (${s.value} times)`).join(', ') || 'Data pending'}
                - Top Performing Specialists (Last 30 Days): ${latestStats.topStylists?.map((s: any) => `${s.name} (${s.value} bookings)`).join(', ') || 'No data yet'}
                - Low Stock Inventory Alerts: ${latestStats.lowStockAlerts?.map((i: any) => `${i.name} (Only ${i.stock} left)`).join(', ') || 'All stock levels healthy'}
                ` : "";

                const groqResponse = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        {
                            role: "system",
                            content: `══════════════════════════════════════
CORE IDENTITY
══════════════════════════════════════
You are an AI-powered PROFESSIONAL BUSINESS ASSISTANT embedded inside this admin dashboard.
• You are NOT a general chatbot—you are a BUSINESS OPERATIONS ASSISTANT.
• Always speak in a clear, confident, professional tone.
• Use the word "business" instead of "salon".
• Be concise, accurate, and actionable.

══════════════════════════════════════
BUSINESS CONTEXT (REAL-TIME DATA)
══════════════════════════════════════
Current Context:
${businessContext}

Use this data EXACTLY when relevant to the user's question.
If exact data is not available, clearly state so.

══════════════════════════════════════
RESPONSE RULES (MANDATORY)
══════════════════════════════════════

1️⃣ ANSWER FIRST
• Start with the direct answer.
• Do NOT add filler sentences like "Sure", "I can help", or greetings.
• Be direct and authoritative.

2️⃣ DATA-DRIVEN
• Always inject real numbers, names, and counts when available.
• Highlight key values using **bold** formatting.
• Present numbers with context (e.g., "**₹5,200 today**" not just "5200").

3️⃣ ACTIONABLE GUIDANCE
• Explain what to do next inside the platform when applicable.
• For "how-to" questions, provide clear step-by-step numbered instructions.
• Reference exact menu locations and button names.

4️⃣ FOLLOW-UP SUGGESTION (OPTIONAL)
• End with 1–2 relevant follow-up questions or actions.
• Never force a follow-up if not needed.

══════════════════════════════════════
INTENT-SPECIFIC HANDLING
══════════════════════════════════════

REVENUE / SALES QUERIES:
→ Show TODAY's metrics first (revenue, sales count, appointments)
→ Then show MONTH totals if relevant
→ Use format: **₹X revenue** from **Y sales**

SERVICES / TOP PERFORMERS:
→ Use "Top Performing Services" data
→ Show service name + booking count
→ If no data: "No completed sales in the last 30 days"

INVENTORY / STOCK:
→ Show LOW STOCK alerts first (critical)
→ Then show healthy stock status
→ Recommend reordering if items are low

PACKAGES:
→ Show "Active Packages" count + list names with prices
→ If asked "how to create": Provide 5-7 step creation flow
→ Include current active package count

APPOINTMENTS / SCHEDULE:
→ Show PENDING REQUESTS count
→ Explain appointment workflow if asked
→ Direct to Appointments page for management

SPECIALISTS / STAFF:
→ Show available specialists by name
→ Link to staff management if relevant
→ Show performance metrics if available

EXPENSE / FINANCIAL:
→ Show today's expenses first
→ Then monthly summary
→ Group by category (Supplies, Rent, Utilities, etc.)

UNCLEAR QUESTIONS:
→ Ask ONE short clarification question
→ Do NOT guess intent
→ Do NOT provide generic responses

══════════════════════════════════════
HOW-TO RESPONSE FORMAT
══════════════════════════════════════

Always use numbered steps for procedural questions:
1. **Action Title** - Description
2. **Action Title** - Description
3. **Action Title** - Description

Example response structure:
📦 **Package Creation Flow**
1. Navigate to **Packages** from sidebar
2. Click **Add Package** button
3. Enter name, description, and price
4. Set validity period (days or 0 for no expiry)
5. Add services and products with quantities
6. Click **Save** to publish

You currently have **{count} active packages**.

══════════════════════════════════════
FORMATTING RULES
══════════════════════════════════════
• Use **bold** for numbers, currency, and key terms
• Use ### for section headers (converted to H3)
• Use bullet points (- or •) for lists
• Use numbered lists for workflows
• Keep paragraphs short (1-2 lines max)
• Avoid emojis unless they add clarity
• Use currency symbol with space: **${amount}** or **₹{amount}**

══════════════════════════════════════
DATA PRESENTATION EXAMPLES
══════════════════════════════════════

Revenue Query Response:
💰 **Today's Business Revenue**
• Revenue: **₹{amount}**
• Sales: **{count} completed**
• Appointments: **{count}**

Would you like a service-wise or specialist-wise breakdown?

---

Inventory Query Response:
📦 **Inventory Status**

⚠️ **Low Stock Alerts**:
- {itemName} (**{count} left**)
- {itemName} (**{count} left**)

✅ **Healthy Stock**:
All other items are above minimum levels.

Reorder low-stock items to avoid disruptions.

---

Service Performance Query Response:
✂️ **Top Services (Last 30 Days)**
1. **{serviceName}** - **{bookingCount} bookings** | **₹{revenue}**
2. **{serviceName}** - **{bookingCount} bookings** | **₹{revenue}**
3. **{serviceName}** - **{bookingCount} bookings** | **₹{revenue}**

Would you like to bundle top services into a package?

══════════════════════════════════════
FAILSAFE BEHAVIOR
══════════════════════════════════════
• If API data is missing → Provide guidance without exact numbers
• If you're unsure → Be conservative and transparent
• Never fabricate metrics or entities
• Always defer to actual platform data

══════════════════════════════════════
CONVERSATION CONTEXT
══════════════════════════════════════
You have access to the last 5 messages for context.
Use this to provide follow-up answers without re-explaining basics.
Reference previous answers: "As we discussed, your revenue today is..."

══════════════════════════════════════
OPTIONAL INTELLIGENCE & UX ENHANCEMENTS
══════════════════════════════════════

FOLLOW-UP SUGGESTION RULES
→ After answering, suggest up to 2 relevant next actions (when useful)
→ Format as: "Want to see **X**?" or "Should I help with **Y**?"
→ Examples:
  • View yesterday's comparison?
  • Open service-wise report?
  • Go to package creation?

ROLE-BASED RESPONSE CONTROL (RBAC)
Respect user role boundaries:
• STAFF:
  - Restricted: Revenue, profit, expenses, full reports
  - Allowed: Appointments, assigned services, workflow help
  - Message: "You don't have permission to view this data."

• MANAGER:
  - Allowed: Revenue summaries, inventory, services, staff
  - Restricted: System settings, API keys

• ADMIN:
  - Full access to all data

CONFIDENCE INDICATORS (When Appropriate)
Use ONE of these per response:
• 📊 Based on real-time business data
• ℹ️ Configuration guidance
• ⚠️ Estimated (data partially available)

STRUCTURED RESPONSE MODE (For Data Queries)
If query involves numbers, lists, or comparisons, use:
TITLE
SUMMARY
DETAILS
NEXT ACTION

Example:
📊 **Today's Performance**

Summary:
• Revenue: **₹5,200**
• Sales: **8 completed**

Details:
• Top service: Hair Cut (45 bookings)
• Pending requests: 3

Next Action:
Want to see yesterday's comparison?

INTENT CLARIFICATION RULE
If multiple interpretations exist:
• Ask ONE short clarification question only
• Example: "Do you want today's data or this month's summary?"
• Do NOT ask multiple questions

UI ACTION AWARENESS
When user asks "how" or "add/create/manage":
• Reference exact UI labels:
  - Click **Services → Add Service**
  - Go to **Packages → Add Package**
  - Navigate to **Specialists → Add Specialist**
• Assume sidebar navigation and action buttons exist

NO-HALLUCINATION GUARANTEE
NEVER invent:
• Numbers, revenue, or metrics
• Customer or staff names
• Data that's not provided
→ If missing: "This data isn't available right now."

SHORT RESPONSE MODE (For Yes/No Questions)
• Respond in 1–2 lines maximum
• No unnecessary follow-ups
• Get straight to the point

COMPARISON RULE (For Trend Questions)
If user asks: "better", "increase", "compare", "trend"
• Include comparison point (yesterday, last month, average)
• Add short insight
• Example: "Revenue is up **12% compared to yesterday**."

TONE & LANGUAGE
• Professional and business-focused
• Clear and direct
• No emojis unless they add clarity
• No marketing language
• Use "business" terminology

══════════════════════════════════════
YOUR ULTIMATE GOAL
══════════════════════════════════════
Behave like a BUSINESS CO-PILOT:
• Help users make informed decisions
• Guide them through platform actions
• Reduce manual thinking and research
• Provide real-time, actionable insights

ALWAYS prioritize clarity, accuracy, and usefulness.`
                        },
                        ...messages.slice(-5).map(m => ({
                            role: m.type === 'user' ? 'user' : 'assistant',
                            content: m.content
                        })),
                        { role: "user", content: messageContent }
                    ]
                }, {
                    headers: {
                        'Authorization': `Bearer ${groqApiKey}`,
                        'Content-Type': 'application/json'
                    }
                });
                responseText = groqResponse.data.choices[0].message.content;
            } catch (error) {
                console.error('Groq API Error:', error);
                responseText = getAIResponse(messageContent, latestStats, symbol); // Fallback with data
            }
        } else {
            // Simulated delay for fallback
            await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));
            responseText = getAIResponse(messageContent, latestStats, symbol);
        }

        const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: 'ai',
            content: responseText,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, aiResponse]);
        setIsTyping(false);
    };

    const handleCopy = (content: string) => {
        navigator.clipboard.writeText(content);
    };

    const handleSuggestionClick = (suggestion: string) => {
        setInputValue(suggestion);
        setShowSuggestions(false);
        handleSendMessage(suggestion);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions) {
            if (e.key === 'Enter') handleSendMessage();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedSuggestionIndex(prev =>
                prev < filteredSuggestions.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : prev);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredSuggestions[selectedSuggestionIndex]) {
                handleSuggestionClick(filteredSuggestions[selectedSuggestionIndex]);
            }
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    return (
        <div style={{
            height: 'calc(100vh - 5rem)',
            display: 'flex',
            background: 'var(--bg-body)',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Sidebar - Quick Actions */}
            <div className="glass" style={{
                width: '300px',
                borderRight: '1px solid var(--glass-border)',
                padding: 'var(--spacing-xl) var(--spacing-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-md)',
                zIndex: 10
            }}>
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        marginBottom: '0.5rem'
                    }}>
                        <Sparkles size={24} className="text-gradient" />
                        <h2 className="text-gradient" style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.04em' }}>
                            AI Assistant
                        </h2>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-gray)', fontWeight: 500 }}>
                        Quick actions to get started
                    </p>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', paddingRight: '4px' }}>
                    {QUICK_ACTIONS.map((action, index) => (
                        <motion.button
                            key={index}
                            whileHover={{ x: 6, background: 'var(--grad-primary)', borderColor: 'transparent' }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => handleSendMessage(action.query)}
                            style={{
                                padding: '1rem',
                                background: 'var(--glass-bg)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: 'var(--radius-lg)',
                                cursor: 'pointer',
                                transition: 'all var(--transition-base)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.875rem',
                                textAlign: 'left',
                                boxShadow: 'var(--shadow-sm)'
                            }}
                            onMouseEnter={(e) => {
                                const label = e.currentTarget.querySelector('.action-label') as HTMLElement;
                                const icon = e.currentTarget.querySelector('.action-icon') as HTMLElement;
                                if (label) label.style.color = 'white';
                                if (icon) icon.style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                                const label = e.currentTarget.querySelector('.action-label') as HTMLElement;
                                const icon = e.currentTarget.querySelector('.action-icon') as HTMLElement;
                                if (label) label.style.color = 'var(--text-dark)';
                                if (icon) icon.style.opacity = '0.5';
                            }}
                        >
                            <span style={{ fontSize: '1.5rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>{action.icon}</span>
                            <span className="action-label" style={{ flex: 1, fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text-dark)', transition: 'color 0.2s' }}>
                                {action.label}
                            </span>
                            <ChevronRight className="action-icon" size={16} color="white" style={{ opacity: 0.5, transition: 'opacity 0.2s' }} />
                        </motion.button>
                    ))}
                </div>

                {messages.length > 0 && (
                    <button
                        onClick={() => setMessages([])}
                        style={{
                            padding: '0.875rem',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: 'var(--radius-lg)',
                            color: 'var(--danger)',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 'var(--spacing-sm)',
                            transition: 'all var(--transition-base)'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                            e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                            e.currentTarget.style.transform = 'scale(1)';
                        }}
                    >
                        <RotateCcw size={16} />
                        Clear Chat
                    </button>
                )}
            </div>

            {/* Main Chat Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Messages */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '2rem',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {messages.length === 0 ? (
                        <div style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            maxWidth: '700px',
                            margin: '0 auto'
                        }}>
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                                style={{
                                    width: '100px',
                                    height: '100px',
                                    borderRadius: '32px',
                                    background: 'var(--grad-primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 'var(--spacing-xl)',
                                    boxShadow: 'var(--shadow-xl), var(--shadow-colored)',
                                    transform: 'rotate(-5deg)',
                                    position: 'relative'
                                }}>
                                <MessageSquare size={48} color="white" />
                                <div style={{
                                    position: 'absolute',
                                    inset: '-10px',
                                    borderRadius: '38px',
                                    border: '2px dashed var(--primary)',
                                    opacity: 0.3,
                                    animation: 'spin 10s linear infinite'
                                }} />
                            </motion.div>
                            <h1 className="text-gradient" style={{ fontSize: '3.5rem', fontWeight: 900, color: 'var(--text-dark)', marginBottom: '1rem', letterSpacing: '-0.06em' }}>
                                How can I help today?
                            </h1>
                            <p style={{ fontSize: '1.25rem', color: 'var(--text-gray)', marginBottom: '3rem', lineHeight: '1.7', fontWeight: 500, maxWidth: '600px' }}>
                                Your AI business companion is ready to assist with appointments, analytics, and everyday management tasks.
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {['Today\'s Revenue', 'Staff Management', 'Top Services'].map((label, i) => (
                                    <motion.button
                                        key={label}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 * i }}
                                        onClick={() => {
                                            const queryMap: any = { 'Today\'s Revenue': 'revenue', 'Staff Management': 'stylist', 'Top Services': 'services' };
                                            handleSendMessage(AI_RESPONSES[queryMap[label]] || label);
                                        }}
                                        className="btn btn-outline glass"
                                        style={{
                                            borderRadius: 'var(--radius-full)',
                                            padding: '0.875rem 1.75rem',
                                            fontWeight: 700,
                                            border: '1px solid var(--glass-border)',
                                            boxShadow: 'var(--shadow-sm)'
                                        }}
                                    >
                                        {label}
                                    </motion.button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>
                            <AnimatePresence>
                                {messages.map((message, index) => (
                                    <motion.div
                                        key={message.id}
                                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        style={{
                                            display: 'flex',
                                            justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start',
                                            marginBottom: '2rem'
                                        }}
                                    >
                                        <div className={message.type === 'ai' ? 'glass' : ''} style={{
                                            maxWidth: '85%',
                                            padding: '1.5rem',
                                            borderRadius: message.type === 'user' ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
                                            background: message.type === 'user'
                                                ? 'var(--grad-primary)'
                                                : 'var(--glass-bg)',
                                            color: message.type === 'user' ? 'white' : 'var(--text-dark)',
                                            boxShadow: message.type === 'user'
                                                ? 'var(--shadow-xl), var(--shadow-colored)'
                                                : 'var(--shadow-lg)',
                                            position: 'relative',
                                            border: '1px solid var(--glass-border)',
                                            backdropFilter: message.type === 'ai' ? 'blur(var(--glass-blur))' : 'none'
                                        }}>
                                            {message.type === 'ai' && (
                                                <div style={{ position: 'absolute', left: '-3rem', top: '0', background: 'var(--grad-primary)', padding: '0.5rem', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)' }}>
                                                    <Sparkles size={16} color="white" />
                                                </div>
                                            )}
                                            <div style={{
                                                margin: 0,
                                                fontSize: '1.0625rem',
                                                lineHeight: '1.8',
                                                whiteSpace: 'pre-wrap',
                                                fontWeight: message.type === 'user' ? 600 : 450,
                                                letterSpacing: '-0.01em'
                                            }}>
                                                {message.type === 'ai' && index === messages.length - 1 ? (
                                                    <StreamingMessage content={message.content} />
                                                ) : (
                                                    <div className="markdown-container">
                                                        {/* Static fallback formatter for history */}
                                                        {(() => {
                                                            let text = String(message.content || '');
                                                            if (!text) return null;
                                                            text = text.replace(/^###\s+(.*$)/gm, '<h3 class="ai-h3">$1</h3>');
                                                            text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                                                            text = text.replace(/^\s*[\-\•]\s+(.*$)/gm, '<li class="ai-li">$1</li>');
                                                            text = text.replace(/(<li.*<\/li>)+/g, '<ul class="ai-ul">$&</ul>');
                                                            return <div dangerouslySetInnerHTML={{ __html: text }} />;
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                            {message.type === 'ai' && (
                                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                                                    <button
                                                        onClick={() => handleCopy(message.content)}
                                                        className="btn btn-ghost"
                                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', gap: '0.4rem' }}
                                                    >
                                                        <Copy size={14} /> Copy
                                                    </button>
                                                    <button
                                                        onClick={() => handleSendMessage(messages[index - 1]?.content)}
                                                        className="btn btn-ghost"
                                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', gap: '0.4rem' }}
                                                    >
                                                        <RotateCcw size={14} /> Regenerate
                                                    </button>
                                                </div>
                                            )}
                                            <div style={{
                                                marginTop: '0.75rem',
                                                fontSize: '0.7rem',
                                                opacity: 0.5,
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                textAlign: message.type === 'user' ? 'right' : 'left'
                                            }}>
                                                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}
                                >
                                    <div className="glass" style={{
                                        padding: '1.25rem 1.5rem',
                                        borderRadius: '24px 24px 24px 4px',
                                        background: 'var(--glass-bg)',
                                        border: '1px solid var(--glass-border)',
                                        boxShadow: 'var(--shadow-sm)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.75rem'
                                    }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', animation: 'bounce 1.4s infinite ease-in-out', opacity: 0.4 }} />
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', animation: 'bounce 1.4s infinite ease-in-out 0.2s', opacity: 0.7 }} />
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', animation: 'bounce 1.4s infinite ease-in-out 0.4s' }} />
                                        <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-gray)', marginLeft: '0.5rem' }}>AI is thinking...</span>
                                    </div>
                                </motion.div>
                            )}

                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="glass" style={{
                    padding: 'var(--spacing-lg) var(--spacing-xl)',
                    borderTop: '1px solid var(--glass-border)',
                    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.05)',
                    position: 'relative',
                    zIndex: 20
                }}>
                    <div style={{
                        maxWidth: '800px',
                        margin: '0 auto',
                        position: 'relative'
                    }}>
                        {/* Suggestions Dropdown */}
                        {showSuggestions && filteredSuggestions.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: 0,
                                    right: '120px',
                                    background: 'var(--glass-bg)',
                                    backdropFilter: 'blur(var(--glass-blur))',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: 'var(--radius-xl)',
                                    marginBottom: 'var(--spacing-sm)',
                                    boxShadow: 'var(--shadow-xl)',
                                    maxHeight: '280px',
                                    overflowY: 'auto',
                                    zIndex: 50
                                }}>
                                {filteredSuggestions.map((suggestion, index) => (
                                    <div
                                        key={index}
                                        onClick={() => handleSuggestionClick(suggestion)}
                                        style={{
                                            padding: '0.875rem 1.25rem',
                                            cursor: 'pointer',
                                            background: index === selectedSuggestionIndex ? '#f1f5f9' : 'white',
                                            borderBottom: index < filteredSuggestions.length - 1 ? '1px solid #f1f5f9' : 'none',
                                            fontSize: '0.9375rem',
                                            color: '#334155',
                                            transition: 'background 0.15s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.background = '#f1f5f9';
                                            setSelectedSuggestionIndex(index);
                                        }}
                                        onMouseLeave={(e) => {
                                            if (index !== selectedSuggestionIndex) {
                                                e.currentTarget.style.background = 'white';
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Sparkles size={14} color="#234C6A" />
                                            {suggestion}
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        )}

                        <div style={{
                            display: 'flex',
                            gap: 'var(--spacing-md)',
                            alignItems: 'center'
                        }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Message AI Assistant..."
                                    className="form-control"
                                    style={{
                                        padding: '1rem 1.5rem',
                                        height: '56px',
                                        fontSize: '1rem',
                                        background: 'var(--glass-bg)',
                                        borderColor: 'var(--glass-border)',
                                        backdropFilter: 'blur(var(--glass-blur))',
                                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                                        borderRadius: 'var(--radius-xl)'
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--primary)';
                                        e.currentTarget.style.boxShadow = '0 0 0 4px var(--primary-light), inset 0 2px 4px rgba(0,0,0,0.02)';
                                    }}
                                    onBlur={(e) => {
                                        setTimeout(() => setShowSuggestions(false), 200);
                                        e.currentTarget.style.borderColor = 'var(--glass-border)';
                                        e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';
                                    }}
                                />
                                <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                                    <Sparkles size={20} className="text-gradient" />
                                </div>
                            </div>
                            <motion.button
                                whileHover={{ scale: 1.05, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleSendMessage()}
                                disabled={!inputValue.trim() || isTyping}
                                style={{
                                    height: '56px',
                                    padding: '0 2rem',
                                    background: inputValue.trim() && !isTyping ? 'var(--grad-primary)' : 'var(--bg-hover)',
                                    color: inputValue.trim() && !isTyping ? 'white' : 'var(--text-light)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-xl)',
                                    fontSize: '1rem',
                                    fontWeight: 800,
                                    cursor: inputValue.trim() && !isTyping ? 'pointer' : 'not-allowed',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    transition: 'all var(--transition-base)',
                                    boxShadow: inputValue.trim() && !isTyping ? 'var(--shadow-xl), var(--shadow-colored)' : 'none'
                                }}
                            >
                                <Send size={20} />
                                <span>Send</span>
                            </motion.button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
      @keyframes bounce {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1.2); opacity: 1; }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .markdown-container strong { color: var(--primary); font-weight: 800; }
      .ai-h3 { 
        font-size: 1.25rem; 
        font-weight: 800; 
        margin: 1.5rem 0 0.75rem 0; 
        color: var(--text-dark);
        letter-spacing: -0.02em;
      }
      .ai-ul { margin: 1rem 0; padding-left: 1.25rem; }
      .ai-li { margin-bottom: 0.5rem; }
      .markdown-container p { margin-bottom: 1rem; }
      `}</style>
        </div>
    );
};
