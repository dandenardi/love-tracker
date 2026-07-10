import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

export type InsightDomain = 'solo' | 'couple';

/**
 * Structured, privacy-minimized event data sent to the AI provider.
 * Deliberately excludes free-text `note`/`title` (spec 002 Privacy & Safety).
 */
export interface AnonymizedEventSummary {
  id: string;
  type: string;
  intensity: number;
  moodTag?: string;
  /** Days since the earliest event in the analyzed window (0-indexed) — never an absolute date. */
  dayOffset: number;
  /**
   * One-way hash of the local contact_id — solo domain only. Events sharing a contactToken
   * involve the same (unnamed) person; absent for partner-linked and unlinked events. See
   * specs/006-pseudonymous-contact-tokens.
   */
  contactToken?: string;
}

export interface InsightRequest {
  userId: string;
  domain: InsightDomain;
  events: AnonymizedEventSummary[];
  locale: string;
}

export interface InsightResult {
  title: string;
  body: string;
  evidenceEventIds: string[];
  confidence: 'low' | 'medium' | 'high';
  generatedAt: number;
}

export interface AIInsightProvider {
  generateInsight(input: InsightRequest): Promise<InsightResult>;
}

const InsightResultSchema = z.object({
  title: z.string().describe('A short, specific headline for the pattern found (max ~10 words).'),
  body: z.string().describe('2-4 sentences explaining the pattern in plain, empathetic language.'),
  evidenceEventIds: z
    .array(z.string())
    .describe('The `id` values of the input events that support this conclusion. Must be a subset of the ids you were given.'),
  confidence: z
    .enum(['low', 'medium', 'high'])
    .describe('How confident you are that this reflects a real, recurring pattern rather than noise.'),
});

const SYSTEM_PROMPT = `You are the AI Insights engine for Love Tracker, a relationship/dating journal app.
You will be given a JSON list of a user's logged events (structured fields only — never raw diary text) and must find ONE genuine, specific behavioral pattern.

Rules:
- Base your finding strictly on the provided events. Never invent details not derivable from the data.
- Every event in "evidenceEventIds" MUST be one of the "id" values you were given.
- If the data is too sparse or noisy to support a confident pattern, say so honestly and set confidence to "low" rather than fabricating a strong claim.
- Write for the user directly, in a warm, non-judgmental, observational tone — never clinical or accusatory.
- Respond in the language given by the "locale" field (e.g. "pt" = Portuguese, "en" = English).
- "solo" domain: the user is single/dating casually. Look for patterns in event type frequency, timing, mood, and intensity over time. Some events include a "contactToken" — an opaque tag, never a name or identifier you can interpret. Events sharing the same contactToken are about the same (unnamed) person; use this to detect person-specific recurring patterns (e.g. "you tend to disengage before the 4th date with the same person") in addition to aggregate trends. Never mention the token itself in your output — refer to "someone" or "a person" instead.
- "couple" domain: the user is in a tracked relationship. The event set already respects their privacy — analyze it as-is.`;

export class AnthropicInsightProvider implements AIInsightProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async generateInsight(input: InsightRequest): Promise<InsightResult> {
    const userPayload = {
      domain: input.domain,
      locale: input.locale,
      events: input.events,
    };

    const response = await this.client.messages.parse({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
      output_config: {
        effort: 'high',
        format: zodOutputFormat(InsightResultSchema),
      },
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: JSON.stringify(userPayload),
        },
      ],
    });

    if (!response.parsed_output) {
      throw new Error('AI provider returned no parsable output');
    }

    const validEventIds = new Set(input.events.map((e) => e.id));
    const evidenceEventIds = response.parsed_output.evidenceEventIds.filter((id) => validEventIds.has(id));

    return {
      title: response.parsed_output.title,
      body: response.parsed_output.body,
      evidenceEventIds,
      confidence: response.parsed_output.confidence,
      generatedAt: Date.now(),
    };
  }
}
