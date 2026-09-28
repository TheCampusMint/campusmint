import type { ContentPoll, ContentPollInput } from "@/types/content";

export type PollDefinition = {
  question: string;
  options: Array<{ id: string; label: string }>;
};

export function validatePollInput(value: unknown): ContentPollInput | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) throw new Error("Add a question and two to six poll options.");
  const input = value as Record<string, unknown>;
  const question = typeof input.question === "string" ? input.question.trim() : "";
  if (!question || question.length > 280) throw new Error("Keep the poll question between 1 and 280 characters.");
  if (!Array.isArray(input.options) || input.options.length < 2 || input.options.length > 6) {
    throw new Error("Add two to six poll options.");
  }
  const options = input.options.map((option) => typeof option === "string" ? option.trim() : "");
  if (options.some((option) => !option || option.length > 100)) throw new Error("Keep each poll option between 1 and 100 characters.");
  if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) throw new Error("Give each poll option a different answer.");
  return { question, options };
}

export function createPollDefinition(input: ContentPollInput): PollDefinition {
  return { question: input.question, options: input.options.map((label, index) => ({ id: String(index + 1), label })) };
}

/** Used for a newly created fixture only; production totals always come from the database. */
export function emptyPoll(input: ContentPollInput): ContentPoll {
  const definition = createPollDefinition(input);
  return { ...definition, options: definition.options.map((option) => ({ ...option, voteCount: 0 })), totalVotes: 0, selectedOptionId: null };
}
