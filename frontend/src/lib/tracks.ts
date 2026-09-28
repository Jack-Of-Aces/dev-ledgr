/**
 * @file tracks.ts
 * @description Canonical engineering tracks, target roles, and smart-inference logic for DevLedgr.
 * Ensures personalized onboarding and avoids misallocating roles (e.g., DevOps to Full-Stack, Product Designer to Backend).
 */

import { EngineeringTrack, TrackDefinition } from '@/types';

export const ENGINEERING_TRACKS: Record<EngineeringTrack, TrackDefinition> = {
  'devops-infra': {
    id: 'devops-infra',
    title: 'DevOps & Cloud Infrastructure',
    shortTitle: 'DevOps / SRE',
    tagline: 'Orchestrating resilient cloud infrastructure, Kubernetes clusters, and automated CI/CD mesh.',
    description: 'Specializes in site reliability, infrastructure-as-code (Terraform/OpenTofu), containerization, observability metrics (Prometheus/Grafana), and zero-downtime deployment pipelines.',
    targetRoles: [
      'DevOps Engineer',
      'Site Reliability Engineer (SRE)',
      'Cloud Platform Engineer',
      'Infrastructure Architect',
    ],
    defaultSkills: [
      'Kubernetes',
      'Terraform',
      'Docker',
      'GitHub Actions',
      'Linux',
      'Prometheus',
      'AWS',
      'Helm',
    ],
    recommendedIdeaIds: ['k8s-canary-ingress', 'schema-migration-guard', 'sms-otp-circuitbreaker'],
    inferredKeywords: [
      'terraform',
      'dockerfile',
      'hcl',
      'helm',
      'k8s',
      'kubernetes',
      'ansible',
      'packer',
      'ci/cd',
      'github-actions',
      'cloudformation',
      'grafana',
      'prometheus',
      'argocd',
      'istio',
      'aws',
      'devops',
      'sre',
      'infrastructure',
    ],
  },

  'backend-systems': {
    id: 'backend-systems',
    title: 'Backend & Distributed Systems',
    shortTitle: 'Backend / Systems',
    tagline: 'Building zero-loss, high-concurrency transactional backends and event streams.',
    description: 'Designs fault-tolerant APIs, distributed state synchronizers, payment idempotency systems, database locking models, and high-throughput data processing services.',
    targetRoles: [
      'Backend Engineer',
      'Distributed Systems Engineer',
      'API Platform Engineer',
      'Core Banking / Fintech Engineer',
    ],
    defaultSkills: [
      'Go',
      'PostgreSQL',
      'Redis',
      'Kafka',
      'gRPC',
      'FastAPI',
      'Docker',
      'CRDT',
    ],
    recommendedIdeaIds: ['webhook-deduplicator', 'lpg-route-optimizer', 'ussd-session-reconciler'],
    inferredKeywords: [
      'go',
      'golang',
      'rust',
      'postgresql',
      'kafka',
      'redis',
      'grpc',
      'microservice',
      'distributed',
      'backend',
      'fastapi',
      'sql',
      'event-driven',
      'rabitmq',
    ],
  },

  'frontend-ui': {
    id: 'frontend-ui',
    title: 'Frontend & Web Performance',
    shortTitle: 'Frontend / Web',
    tagline: 'Crafting responsive, zero-layout-shift web applications with pristine Core Web Vitals.',
    description: 'Expertise in modern Next.js App Router, reactive client states, fluid animations, typography hierarchy, accessibility (ARIA), and tactile design-token implementation.',
    targetRoles: [
      'Frontend Engineer',
      'Web Performance Engineer',
      'UI Systems Developer',
      'Client Platform Engineer',
    ],
    defaultSkills: [
      'Next.js',
      'React',
      'TypeScript',
      'Tailwind CSS',
      'Zustand',
      'Web Vitals',
      'GraphQL',
      'Accessible ARIA',
    ],
    recommendedIdeaIds: ['optimistic-ledger-design-system', 'offline-sync-clinic'],
    inferredKeywords: [
      'react',
      'nextjs',
      'vue',
      'svelte',
      'typescript',
      'tailwind',
      'css',
      'html',
      'web-performance',
      'ui',
      'frontend',
      'vite',
      'redux',
      'zustand',
    ],
  },

  'fullstack': {
    id: 'fullstack',
    title: 'Full-Stack Engineering',
    shortTitle: 'Full-Stack',
    tagline: 'Shipping complete end-to-end products from relational databases to polished user interfaces.',
    description: 'Bridges server-side logic and front-of-house UI, maintaining database schemas, REST/tRPC APIs, authentication layers, and client-side reactive architectures.',
    targetRoles: [
      'Full-Stack Engineer',
      'Founding Product Engineer',
      'Web Applications Developer',
      'Platform Integrations Lead',
    ],
    defaultSkills: [
      'TypeScript',
      'Next.js',
      'Node.js',
      'PostgreSQL',
      'Prisma',
      'Redis',
      'Tailwind CSS',
      'Docker',
    ],
    recommendedIdeaIds: ['offline-sync-clinic', 'lpg-route-optimizer', 'webhook-deduplicator'],
    inferredKeywords: [
      'fullstack',
      'node',
      'nodejs',
      'express',
      'prisma',
      'drizzle',
      'trpc',
      'mongodb',
      'supbase',
      'nestjs',
    ],
  },

  'product-design': {
    id: 'product-design',
    title: 'Product Design & Design Systems',
    shortTitle: 'Design Systems',
    tagline: 'Engineering cohesive design tokens, tactile components, and high-fidelity user workflows.',
    description: 'Blends UX architecture, Figma design token systems, accessibility contrast standards, micro-interactions, and design-to-code implementations.',
    targetRoles: [
      'Product Designer',
      'Design Systems Engineer',
      'UI/UX Architect',
      'Design Technologist',
    ],
    defaultSkills: [
      'Design Systems',
      'Figma Tokens',
      'Tailwind CSS',
      'Accessible ARIA',
      'CSS Subgrid',
      'Micro-interactions',
      'Prototyping',
    ],
    recommendedIdeaIds: ['optimistic-ledger-design-system'],
    inferredKeywords: [
      'figma',
      'design-system',
      'storybook',
      'ui/ux',
      'wireframe',
      'tokens',
      'a11y',
      'design',
      'accessibility',
      'typography',
    ],
  },

  'ai-ml': {
    id: 'ai-ml',
    title: 'AI & Machine Learning Systems',
    shortTitle: 'AI / ML Systems',
    tagline: 'Productionizing vector embeddings, LLM agent pipelines, and high-throughput model inference.',
    description: 'Focuses on retrieval-augmented generation (RAG) caches, semantic gateways, model fine-tuning, embeddings storage (pgvector), and low-latency inference pipelines.',
    targetRoles: [
      'AI Engineer',
      'MLOps Engineer',
      'LLM Applications Architect',
      'Applied Machine Learning Engineer',
    ],
    defaultSkills: [
      'Python',
      'FastAPI',
      'PyTorch',
      'pgvector',
      'LangChain',
      'Docker',
      'OpenAI / Gemini',
      'Vector Databases',
    ],
    recommendedIdeaIds: ['solar-minigrid-timeseries', 'webhook-deduplicator'],
    inferredKeywords: [
      'python',
      'jupyter',
      'pytorch',
      'tensorflow',
      'langchain',
      'llm',
      'rag',
      'embeddings',
      'vector',
      'ai',
      'machine-learning',
      'pandas',
      'numpy',
    ],
  },

  'mobile': {
    id: 'mobile',
    title: 'Mobile Engineering',
    shortTitle: 'Mobile',
    tagline: 'Architecting offline-first mobile apps, cross-platform runtimes, and local SQLite caches.',
    description: 'Specializes in iOS and Android development, React Native / Flutter, background sync, biometric security, push notifications, and constrained-bandwidth performance.',
    targetRoles: [
      'Mobile Engineer',
      'iOS Engineer',
      'Android Engineer',
      'React Native Developer',
    ],
    defaultSkills: [
      'React Native',
      'Flutter',
      'Swift',
      'Kotlin',
      'SQLite',
      'Expo',
      'TypeScript',
      'Mobile Security',
    ],
    recommendedIdeaIds: ['offline-sync-clinic'],
    inferredKeywords: [
      'react-native',
      'flutter',
      'swift',
      'kotlin',
      'android',
      'ios',
      'expo',
      'mobile',
      'xcode',
    ],
  },
};

export function getAllTracks(): TrackDefinition[] {
  return Object.values(ENGINEERING_TRACKS);
}

export function getTrackById(trackId: EngineeringTrack): TrackDefinition {
  return ENGINEERING_TRACKS[trackId] || ENGINEERING_TRACKS['backend-systems'];
}

export interface InferredTrackResult {
  track: TrackDefinition;
  confidence: number;
  rationale: string;
  topLanguages: string[];
  detectedKeywords: string[];
}

/**
 * Heuristically infers an engineering track based on public GitHub repository metadata,
 * language distribution, and profile bio keywords.
 */
export function inferTrackFromRepoData(
  languages: string[] = [],
  repoNames: string[] = [],
  bio: string = ''
): InferredTrackResult {
  const normalizedLangs = languages.map((l) => l.toLowerCase());
  const normalizedRepos = repoNames.map((r) => r.toLowerCase());
  const normalizedBio = bio.toLowerCase();

  const allTokens = [
    ...normalizedLangs,
    ...normalizedRepos.flatMap((r) => r.split(/[-_./]/)),
    ...normalizedBio.split(/\s+/),
  ].filter(Boolean);

  const scores: Record<EngineeringTrack, { score: number; matchedKeywords: string[] }> = {
    'devops-infra': { score: 0, matchedKeywords: [] },
    'backend-systems': { score: 0, matchedKeywords: [] },
    'frontend-ui': { score: 0, matchedKeywords: [] },
    'fullstack': { score: 0, matchedKeywords: [] },
    'product-design': { score: 0, matchedKeywords: [] },
    'ai-ml': { score: 0, matchedKeywords: [] },
    'mobile': { score: 0, matchedKeywords: [] },
  };

  for (const [trackId, def] of Object.entries(ENGINEERING_TRACKS) as [EngineeringTrack, TrackDefinition][]) {
    for (const keyword of def.inferredKeywords) {
      if (allTokens.some((token) => token.includes(keyword) || keyword.includes(token))) {
        scores[trackId].score += 2;
        if (!scores[trackId].matchedKeywords.includes(keyword)) {
          scores[trackId].matchedKeywords.push(keyword);
        }
      }
    }
  }

  // Weight primary languages
  if (normalizedLangs.some((l) => ['hcl', 'dockerfile', 'shell', 'nix'].includes(l))) {
    scores['devops-infra'].score += 5;
  }
  if (normalizedLangs.some((l) => ['go', 'rust', 'c++', 'c', 'java', 'elixir'].includes(l))) {
    scores['backend-systems'].score += 4;
  }
  if (normalizedLangs.some((l) => ['html', 'css', 'scss', 'vue', 'svelte'].includes(l))) {
    scores['frontend-ui'].score += 4;
  }
  if (normalizedLangs.some((l) => ['jupyter notebook', 'python'].includes(l))) {
    scores['ai-ml'].score += 3;
  }
  if (normalizedLangs.some((l) => ['swift', 'kotlin', 'dart'].includes(l))) {
    scores['mobile'].score += 5;
  }

  // Find track with highest score
  let bestTrack: EngineeringTrack = 'backend-systems';
  let maxScore = -1;

  for (const [trackId, data] of Object.entries(scores) as [EngineeringTrack, { score: number; matchedKeywords: string[] }][]) {
    if (data.score > maxScore) {
      maxScore = data.score;
      bestTrack = trackId;
    }
  }

  // Default to backend or fullstack if insufficient signal
  const detectedKeywords = scores[bestTrack].matchedKeywords.slice(0, 4);
  const confidence = maxScore >= 6 ? 0.92 : maxScore >= 3 ? 0.74 : 0.55;

  let rationale = `Inferred based on repository activity and technologies.`;
  if (detectedKeywords.length > 0) {
    rationale = `Detected ${detectedKeywords.join(', ')} across recent repositories.`;
  } else if (languages.length > 0) {
    rationale = `Inferred from primary languages: ${languages.slice(0, 3).join(', ')}.`;
  }

  return {
    track: ENGINEERING_TRACKS[bestTrack],
    confidence,
    rationale,
    topLanguages: languages.slice(0, 5),
    detectedKeywords,
  };
}
