export function makeAnthropicMessage(verdict: {
  verdict: string;
  confidence: number;
  reasoning: string;
  signals: string[];
}) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(verdict),
      },
    ],
    usage: {
      input_tokens: 100,
      output_tokens: 50,
    },
  };
}
