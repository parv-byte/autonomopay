export interface AgentBidder {
  id: string;
  name: string;
  role: string;
  avatar: string;
  trustScore: number; // 0 - 100
  historicalContracts: number;
  bidAmount: number;
  slaSeconds: number;
  specialty: string;
  strategy: string;
  utilityScore: number;
  isWinner: boolean;
  bidTimestamp: string;
}

export interface AuctionResult {
  auctionId: string;
  taskTitle: string;
  budgetCeiling: number;
  bidders: AgentBidder[];
  winningAgent: AgentBidder;
  savingsUSD: number;
  savingsPercentage: number;
  reasoning: string;
  timestamp: string;
}

const REGISTERED_BIDDERS = [
  {
    id: 'agent-dataextract-pro',
    name: 'DataExtract Pro',
    role: 'Balanced Precision Agent',
    avatar: '⚙️',
    trustScore: 97.8,
    historicalContracts: 28,
    baseDiscount: 0.94, // 6% under ceiling
    sla: 120, // 2 minutes
    specialty: 'Balanced High-Throughput & Schema Validation',
    strategy: 'Reliability-Optimized'
  },
  {
    id: 'agent-swiftparser-ai',
    name: 'SwiftParser AI',
    role: 'High-Velocity Low-Latency Agent',
    avatar: '⚡',
    trustScore: 94.5,
    historicalContracts: 19,
    baseDiscount: 0.82, // 18% under ceiling
    sla: 45, // 45 seconds
    specialty: 'Ultra-Fast Parallel OCR & Rapid Ingestion',
    strategy: 'Aggressive Cost-Cutting Underbid'
  },
  {
    id: 'agent-cognitivemax-labs',
    name: 'CognitiveMax Labs',
    role: 'Enterprise Precision Agent',
    avatar: '🧠',
    trustScore: 99.4,
    historicalContracts: 54,
    baseDiscount: 0.98, // 2% under ceiling
    sla: 240, // 4 minutes
    specialty: 'Complex Nested Medical/Scientific Schemas',
    strategy: 'Premium Guaranteed SLA'
  }
];

/**
 * Execute real-time multi-agent reverse auction for programmable contracts.
 * Agents autonomously compete on Price, Trust Score, and SLA Latency.
 */
export function runReverseAuction(taskTitle: string, budgetCeiling: number = 100.0): AuctionResult {
  const auctionId = `AUC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  
  // Calculate dynamic bids with subtle jitter
  const bidders: AgentBidder[] = REGISTERED_BIDDERS.map((agent) => {
    // Dynamic bid amount based on base discount and minor market variance
    const variance = (Math.random() * 0.04) - 0.02; // +/- 2%
    const calculatedBid = Math.round(budgetCeiling * (agent.baseDiscount + variance) * 100) / 100;
    
    // Pareto Utility formula:
    // 50% Trust Score weight + 35% Price Savings weight + 15% SLA Latency weight
    const priceSavingsRatio = Math.max(0, (budgetCeiling - calculatedBid) / budgetCeiling);
    const slaScore = Math.max(0, (300 - agent.sla) / 300) * 100;
    
    const utility = Math.round(
      ((agent.trustScore * 0.50) + (priceSavingsRatio * 100 * 0.35) + (slaScore * 0.15)) * 10
    ) / 10;

    return {
      id: agent.id,
      name: agent.name,
      role: agent.role,
      avatar: agent.avatar,
      trustScore: agent.trustScore,
      historicalContracts: agent.historicalContracts,
      bidAmount: calculatedBid,
      slaSeconds: agent.sla,
      specialty: agent.specialty,
      strategy: agent.strategy,
      utilityScore: utility,
      isWinner: false,
      bidTimestamp: new Date().toISOString()
    };
  });

  // Sort bidders by Pareto utility score descending
  bidders.sort((a, b) => b.utilityScore - a.utilityScore);

  // Designate winner
  bidders[0].isWinner = true;
  const winner = bidders[0];
  const savings = Math.round((budgetCeiling - winner.bidAmount) * 100) / 100;
  const savingsPct = Math.round((savings / budgetCeiling) * 1000) / 10;

  const reasoning = `Buyer Agent selected ${winner.name} via Pareto-Optimal Decision Algorithm: Achieved highest utility score of ${winner.utilityScore}/100. Delivered $${savings.toFixed(2)} (${savingsPct}%) escrow budget savings while sustaining an exceptional ${winner.trustScore}% trust score.`;

  return {
    auctionId,
    taskTitle,
    budgetCeiling,
    bidders,
    winningAgent: winner,
    savingsUSD: savings,
    savingsPercentage: savingsPct,
    reasoning,
    timestamp: new Date().toISOString()
  };
}

