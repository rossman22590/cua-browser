import { NextResponse } from "next/server";

export async function POST() {

  try {
    /*const { action, sessionId, userInput, previousItems } = body;

    computer = new BrowserbaseBrowser(1024, 768, "us-west-2", false, sessionId);
    agent = new Agent("computer-use-preview-2025-02-04", computer);

    switch (action) {
      case 'START': {
        if (!sessionId || !userInput) {
          return NextResponse.json(
            { error: 'Missing sessionId or userInput in request body' },
            { status: 400 }
          );
        }

        await computer.connect();

        const initialMessages = [
          {
            "role": "developer",
            "content": "You are a helpful assistant that can use a web browser to accomplish tasks. Your starting point is the Google search page. You can navigate to other websites by searching for them."
          },
          {
            "role": "assistant",
            "content": "What would you like to do today?"
          },
          {
            "role": "user",
            "content": userInput
          }
        ];

        // Initialize the agent with the first step
        const stepResult = await agent.runSingleStep(initialMessages, true, true);

        return NextResponse.json({ 
          success: true, 
          output: stepResult.output,
          done: stepResult.done,
          responseId: stepResult.responseId
        });
      }

      case 'STEP': {
        if (!sessionId) {
          return NextResponse.json(
            { error: 'Missing sessionId in request body' },
            { status: 400 }
          );
        }

        await computer.connect();

        // Process the next step using the previous items
        const inputItems = previousItems || [];
        const stepResult = await agent.runSingleStep(inputItems, true, true);

        return NextResponse.json({ 
          success: true, 
          output: stepResult.output,
          done: stepResult.done,
          responseId: stepResult.responseId
        });
      }

      case 'CONTINUE': {
        if (!sessionId || !userInput) {
          return NextResponse.json(
            { error: 'Missing required parameters' },
            { status: 400 }
          );
        }

        await computer.connect();

        // Start a new conversation turn with the user input
        const stepResult = await agent.runSingleStep([
          {
            "role": "user",
            "content": userInput
          }
        ], true, true);

        return NextResponse.json({ 
          success: true, 
          output: stepResult.output,
          done: stepResult.done,
          responseId: stepResult.responseId
        });
      }

      case 'HANDLE_COMPUTER_CALL': {
        if (!sessionId || !body.computerCallId) {
          return NextResponse.json(
            { error: 'Missing required parameters' },
            { status: 400 }
          );
        }

        await computer.connect();

        const outputItem = body.outputItem;
        
        // Process the computer call as a single step
        const stepResult = await agent.runSingleStep([outputItem], true, true);

        return NextResponse.json({ 
          success: true, 
          output: stepResult.output,
          done: stepResult.done,
          responseId: stepResult.responseId
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action type' },
          { status: 400 }
        );
    }*/
    return NextResponse.json({ error: "Invalid action type" }, { status: 400 });
  } catch (error) {
    console.error("Error in operator endpoint:", error);
    return NextResponse.json(
      { success: false, error: "Failed to process request" },
      { status: 500 }
    );
  }
}
