import { TopicType } from './types';

export interface TopicPreset {
  id: string;
  category: TopicType;
  title: string;
  description: string;
  caseBrief?: string;
}

export const TOPIC_PRESETS: TopicPreset[] = [
  // Contemporary
  {
    id: 'contemp-1',
    category: 'CONTEMPORARY',
    title: 'Is AI a threat to entry-level jobs?',
    description: 'Debate how generative AI and automated tooling reshape hiring, apprenticeships, and career entry ladders.'
  },
  {
    id: 'contemp-2',
    category: 'CONTEMPORARY',
    title: 'Remote work vs office culture',
    description: 'Explore the trade-offs between individual flexibility, productivity metrics, and collaborative team synergy.'
  },
  {
    id: 'contemp-3',
    category: 'CONTEMPORARY',
    title: 'Should social media have an age limit?',
    description: 'Examine adolescent mental health, algorithmic addiction, digital literacy, and personal liberty.'
  },

  // Abstract
  {
    id: 'abstract-1',
    category: 'ABSTRACT',
    title: 'The pen is mightier than the sword',
    description: 'Discuss the enduring power of ideology, literature, and diplomacy versus brute force and material coercion.'
  },
  {
    id: 'abstract-2',
    category: 'ABSTRACT',
    title: 'Silence is more powerful than words',
    description: 'Analyze strategic restraint, emotional intelligence, diplomatic pauses, and the perils of excessive noise.'
  },
  {
    id: 'abstract-3',
    category: 'ABSTRACT',
    title: 'A ship in harbour is safe, but that is not what ships are built for',
    description: 'Explore risk-taking, entrepreneurial boldness, comfort zones, and navigating volatile real-world storms.'
  },

  // Controversial
  {
    id: 'contro-1',
    category: 'CONTROVERSIAL',
    title: 'Exams measure memory, not intelligence',
    description: 'Evaluate standard education testing models, critical thinking, rote memorization, and workplace readiness.'
  },
  {
    id: 'contro-2',
    category: 'CONTROVERSIAL',
    title: 'Influencers are the new journalists',
    description: 'Dissect the shift in public trust from legacy newsrooms to decentralized independent creators and social media personalities.'
  },
  {
    id: 'contro-3',
    category: 'CONTROVERSIAL',
    title: 'Grades should be abolished in college',
    description: 'Debate whether grading curves induce toxic burnout and conformity, or if standardized benchmarks are indispensable.'
  },

  // Case-based
  {
    id: 'case-1',
    category: 'CASE',
    title: 'Startup Runway Crisis: Cut Costs or Pivot?',
    description: 'Your startup has 3 months of runway left. Do you conserve capital or make a high-stakes pivot?',
    caseBrief: 'You are the co-founders of a B2B SaaS startup with only 3 months of cash reserves remaining. Your core legacy product is acquiring users slowly, while an unreleased AI tool has gained sudden viral inbound interest. You must decide whether to lay off staff to extend runway or pivot 100% of resources toward the AI tool.'
  },
  {
    id: 'case-2',
    category: 'CASE',
    title: 'College Fest Sponsor Withdrawal: Refund or Scale Down?',
    description: 'Title sponsor pulls out 7 days before opening night with 5,000 paid attendees.',
    caseBrief: 'A Tier-1 college annual cultural fest loses its anchor title sponsor 7 days prior to opening night due to budget cuts. 5,000 paid attendee tickets have already been sold, and major headline artists require upfront payment. The committee must decide whether to cancel the main celebrity night and refund tickets, or rapidly downgrade production and find alternate micro-sponsors.'
  },
  {
    id: 'case-3',
    category: 'CASE',
    title: 'Hospital ICU Triage Algorithm: Survival Probability vs Arrival Time?',
    description: 'Only 5 ICU beds remaining for 20 critical patients during an emergency surge.',
    caseBrief: 'A major metro hospital faces a critical surge during an outbreak with only 5 ICU beds remaining for 20 incoming critical patients. The newly introduced AI triage algorithm recommends allocating beds solely based on 30-day post-discharge survival probability. The ethics board and medical directors must decide whether to abide strictly by the algorithm or enforce traditional waitlist and age-neutral protocols.'
  }
];
