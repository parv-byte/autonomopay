/**
 * Demo Data Generator
 * 
 * Creates realistic demo scenarios for AutonomoPay.
 * Generates sample deliverables (both good and bad).
 */

import { v4 as uuid } from 'uuid';

/**
 * Generate a successful deliverable - 500 PDF extraction results
 */
export function generateSuccessDeliverable(): string {
  const records = [];
  const journals = [
    'Nature', 'Science', 'Cell', 'PNAS', 'The Lancet',
    'JAMA', 'BMJ', 'IEEE', 'ACM', 'Physical Review Letters',
    'Neuron', 'Genome Research', 'Bioinformatics', 'Ecology Letters',
    'Annual Review of Psychology', 'Chemical Reviews',
  ];
  const authors = [
    'Smith, J.', 'Johnson, A.', 'Williams, R.', 'Brown, M.', 'Davis, K.',
    'Miller, S.', 'Wilson, D.', 'Moore, T.', 'Taylor, C.', 'Anderson, P.',
    'Thomas, L.', 'Jackson, N.', 'White, E.', 'Harris, B.', 'Martin, G.',
    'Thompson, H.', 'Garcia, F.', 'Martinez, I.', 'Robinson, W.', 'Clark, V.',
  ];
  const keywordSets = [
    ['machine learning', 'neural networks', 'deep learning', 'AI'],
    ['genomics', 'CRISPR', 'gene editing', 'biotechnology'],
    ['climate change', 'sustainability', 'carbon emissions', 'environment'],
    ['quantum computing', 'qubits', 'entanglement', 'superposition'],
    ['drug discovery', 'pharmacology', 'clinical trials', 'FDA'],
    ['robotics', 'automation', 'sensors', 'actuators'],
    ['data science', 'statistics', 'big data', 'analytics'],
    ['neuroscience', 'brain imaging', 'cognition', 'synaptic'],
    ['materials science', 'nanotechnology', 'polymers', 'composites'],
    ['renewable energy', 'solar cells', 'wind power', 'batteries'],
  ];

  for (let i = 0; i < 500; i++) {
    const year = 2018 + Math.floor(Math.random() * 7);
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    const journal = journals[Math.floor(Math.random() * journals.length)];
    const author = authors[Math.floor(Math.random() * authors.length)];
    const kwSet = keywordSets[Math.floor(Math.random() * keywordSets.length)];

    records.push({
      id: i + 1,
      title: `Research Paper ${i + 1}: Advanced Study in ${kwSet[0]} and ${kwSet[1]}`,
      author: `${author}; et al.`,
      date: `${year}-${month}-${day}`,
      abstract: `This paper presents a comprehensive study on ${kwSet[0]} and its applications in ${kwSet[1]}. We conducted experiments across ${Math.floor(Math.random() * 50) + 10} datasets and achieved state-of-the-art results with a ${(Math.random() * 10 + 90).toFixed(1)}% accuracy improvement over baseline methods. Our findings suggest significant implications for ${kwSet[2]} and ${kwSet[3]}.`,
      keywords: kwSet,
      doi: `10.${1000 + Math.floor(Math.random() * 9000)}/journal.${journal.toLowerCase().replace(/\s+/g, '')}.${year}.${String(i + 1).padStart(5, '0')}`,
    });
  }

  return JSON.stringify({
    records,
    metadata: {
      totalProcessed: 500,
      totalRequested: 500,
      processingTime: '7m 23s',
      accuracy: 97.2,
      completedAt: new Date().toISOString(),
      engineVersion: '2.1.0',
    },
  });
}

/**
 * Generate a failed/partial deliverable
 */
export function generateFailedDeliverable(): string {
  const records = [];
  const journals = [
    'Nature', 'Science', 'Cell', 'PNAS', 'The Lancet',
  ];
  const authors = [
    'Smith, J.', 'Johnson, A.', 'Williams, R.', 'Brown, M.', 'Davis, K.',
  ];
  const keywordSets = [
    ['machine learning', 'neural networks', 'deep learning', 'AI'],
    ['genomics', 'CRISPR', 'gene editing', 'biotechnology'],
    ['climate change', 'sustainability', 'carbon emissions', 'environment'],
  ];

  // Only generate 467 out of 500
  for (let i = 0; i < 467; i++) {
    const year = 2018 + Math.floor(Math.random() * 7);
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    const journal = journals[Math.floor(Math.random() * journals.length)];
    const author = authors[Math.floor(Math.random() * authors.length)];
    const kwSet = keywordSets[Math.floor(Math.random() * keywordSets.length)];

    const record: Record<string, unknown> = {
      id: i + 1,
      title: `Research Paper ${i + 1}: Study in ${kwSet[0]}`,
      author: `${author}; et al.`,
      date: `${year}-${month}-${day}`,
      abstract: `Study on ${kwSet[0]} with findings related to ${kwSet[1]}.`,
      keywords: kwSet,
      doi: `10.${1000 + Math.floor(Math.random() * 9000)}/journal.${journal.toLowerCase()}.${year}.${String(i + 1).padStart(5, '0')}`,
    };

    // Introduce intentional flaws - 14% missing fields
    if (Math.random() < 0.14) {
      const fieldsToRemove = ['author', 'abstract', 'keywords', 'doi'];
      const fieldToRemove = fieldsToRemove[Math.floor(Math.random() * fieldsToRemove.length)];
      delete record[fieldToRemove];
    }

    records.push(record);
  }

  return JSON.stringify({
    records,
    metadata: {
      totalProcessed: 467,
      totalRequested: 500,
      processingTime: '9m 45s',
      accuracy: 81.4,
      completedAt: new Date().toISOString(),
      engineVersion: '2.0.3',
      errors: [
        '33 documents could not be parsed due to corrupted PDF format',
        'OCR accuracy was below threshold for 47 documents',
      ],
    },
  });
}

/**
 * Default demo contract input
 */
export const DEMO_CONTRACT_INPUT = `Analyze 500 research PDFs and extract title, author, date, abstract, keywords, and DOI into JSON. At least 95% of documents must be successfully processed. Complete within 10 minutes. Budget: $100.`;

/**
 * Seed the database with demo data
 */
export async function seedDemoData(prisma: import('@prisma/client').PrismaClient) {
  // Check if demo user exists
  const existingUser = await prisma.user.findUnique({
    where: { email: 'demo@autonomopay.dev' },
  });

  if (existingUser) {
    return existingUser;
  }

  // Create demo user
  const bcrypt = await import('bcryptjs');
  const hashedPassword = await bcrypt.hash('demo123', 10);

  const user = await prisma.user.create({
    data: {
      id: uuid(),
      email: 'demo@autonomopay.dev',
      name: 'Demo User',
      password: hashedPassword,
    },
  });

  // Create demo agents
  await prisma.agent.create({
    data: {
      id: 'agent-buyer-demo',
      name: 'ResearchBot Alpha',
      type: 'BUYER',
      description: 'AI agent that commissions research analysis tasks',
      avatar: '🤖',
      status: 'ACTIVE',
      userId: user.id,
    },
  });

  await prisma.agent.create({
    data: {
      id: 'agent-worker-demo',
      name: 'DataExtract Pro',
      type: 'WORKER',
      description: 'Specialized AI agent for document analysis and data extraction',
      avatar: '⚙️',
      status: 'ACTIVE',
      userId: user.id,
    },
  });

  await prisma.agent.create({
    data: {
      id: 'agent-verifier-demo',
      name: 'VerifyAI',
      type: 'VERIFIER',
      description: 'Independent AI verification agent',
      avatar: '🔍',
      status: 'ACTIVE',
      userId: user.id,
    },
  });

  await prisma.agent.create({
    data: {
      id: 'agent-arbitrator-demo',
      name: 'ArbitratorAI',
      type: 'ARBITRATOR',
      description: 'AI arbitration agent for dispute resolution',
      avatar: '⚖️',
      status: 'ACTIVE',
      userId: user.id,
    },
  });

  return user;
}
