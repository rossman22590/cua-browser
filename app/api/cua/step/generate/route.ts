import { NextResponse } from "next/server";
import { Agent } from "../../agent/agent";
import { BrowserbaseBrowser } from "../../agent/browserbase";
import { ComputerToolCall } from "../../agent/types";

export async function POST(request: Request) {
  let computer: BrowserbaseBrowser | null = null;
  let agent: Agent | null = null;

  try {
    const body = await request.json();
    const { sessionId, responseId, input } = body;
    console.log("input", input);

    // Validate input format to prevent errors
    if (!input || (typeof input !== 'string' && !Array.isArray(input))) {
      console.log("Invalid input format:", input);
      return NextResponse.json(
        { error: "Invalid input format. Expected string or array." },
        { status: 400 }
      );
    }

    // Convert string input to proper InputItem array format if needed
    const inputItems = typeof input === 'string' 
      ? [{ role: 'user', content: input }] 
      : input;

    computer = new BrowserbaseBrowser(1024, 768, "us-west-2", false, sessionId);
    agent = new Agent("computer-use-preview-2025-02-04", computer);
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId in request body" },
        { status: 400 }
      );
    }

    let result = await agent.getAction(inputItems, responseId);

    // If there's a screenshot returned, just handle it right here so we don't have to make a round trip.
    if (result.output.find((item) => item.type === "computer_call")) {
      const computerCall = result.output.find(
        (item) => item.type === "computer_call"
      ) as ComputerToolCall;
      if (computerCall.action.type === "screenshot") {
        await computer.connect();

        const screenshotAction = await agent.takeAction(result.output);
        result = await agent.getAction(
          screenshotAction.filter((item) => item.type != "message"),
          result.responseId
        );
      }
    }

    // If the generated action is only reasoning, let's request a real action.
    if (
      result.output.length == 1 &&
      result.output.find((item) => item.type === "reasoning")
    ) {
      do {
        result = await agent.getAction(
          [
            {
            role: "user",
            content: "Please continue with the task.",
          },
        ],
          result.responseId
        );
      } while (result.output.length == 1 && result.output.find((item) => item.type === "reasoning"));
    }

    return NextResponse.json([result]);
  } catch (error) {
    console.error("Error in cua endpoint:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}
