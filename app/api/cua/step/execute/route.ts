import { NextResponse } from 'next/server';
import { Agent } from '../../agent/agent';
import { BrowserbaseBrowser } from '../../agent/browserbase';

export async function POST(request: Request) {
  let computer: BrowserbaseBrowser | null = null;
  let agent: Agent | null = null;

  try {
    const body = await request.json();
    const { sessionId, output } = body;
    console.log("output", output);

    // Validate output format to prevent errors
    if (!output || !output.output || !Array.isArray(output.output)) {
      console.log("Invalid output format:", output);
      return NextResponse.json(
        { error: 'Invalid output format. Expected object with output array.' },
        { status: 400 }
      );
    }

    computer = new BrowserbaseBrowser(1024, 768, "us-west-2", false, sessionId);
    agent = new Agent("computer-use-preview-2025-02-04", computer);
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId in request body' },
        { status: 400 }
      );
    }

    await computer.connect();

    const result = await agent.takeAction(output.output);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in cua endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
