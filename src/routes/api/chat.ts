import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, type UIMessage } from "ai";
import { GUIDE_INSTRUCTIONS } from "@/lib/ai/knowledge";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("AI is not configured", { status: 500 });
        let body: { messages?: UIMessage[]; snapshot?: unknown };
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        if (!Array.isArray(body.messages)) return new Response("messages required", { status: 400 });
        const { createResponsesCall } = await import("@/lib/ai/responses.server");
        const instructions = `${GUIDE_INSTRUCTIONS}\n\n\`\`\`json\n${JSON.stringify(body.snapshot ?? {}).slice(0, 4000)}\n\`\`\``;
        const messages = await convertToModelMessages(body.messages.slice(-30));
        return createResponsesCall(
          request,
          { baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, model: "openai/gpt-6-astra" },
          messages,
          instructions,
        ).response();
      },
    },
  },
});
