"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import { useWindowSize } from "usehooks-ts";
import Image from "next/image";
import posthog from "posthog-js";
import {
  FunctionOutput,
  Item,
  ComputerCallOutput,
} from "../api/operator/agent/types";

interface ChatFeedProps {
  initialMessage?: string;
  onClose: () => void;
  url?: string;
}

export interface BrowserStep {
  text: string;
  reasoning: string;
  tool:
    | "GOTO"
    | "ACT"
    | "EXTRACT"
    | "OBSERVE"
    | "CLOSE"
    | "WAIT"
    | "NAVBACK"
    | "MESSAGE"
    | "CLICK"
    | "TYPE"
    | "KEYPRESS"
    | "SCROLL";
  instruction: string;
  stepNumber?: number;
  messageId?: string;
}

interface AgentState {
  sessionId: string | null;
  sessionUrl: string | null;
  connectUrl: string | null;
  steps: BrowserStep[];
  isLoading: boolean;
}

const pulseInputKeyframes = `
@keyframes pulseInput {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 59, 0, 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(255, 59, 0, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 59, 0, 0);
  }
}`;

export default function LegacyChatFeed({
  initialMessage,
  onClose,
}: ChatFeedProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { width } = useWindowSize();
  const isMobile = width ? width < 768 : false;
  const initializationRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [isAgentFinished, setIsAgentFinished] = useState(false);
  const agentStateRef = useRef<AgentState>({
    sessionId: null,
    sessionUrl: null,
    connectUrl: null,
    steps: [],
    isLoading: false,
  });

  const [uiState, setUiState] = useState<{
    sessionId: string | null;
    sessionUrl: string | null;
    connectUrl: string | null;
    steps: BrowserStep[];
  }>({
    sessionId: null,
    sessionUrl: null,
    connectUrl: null,
    steps: [],
  });

  const [userInput, setUserInput] = useState("");
  const [isWaitingForInput, setIsWaitingForInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    if (
      uiState.steps.length > 0 &&
      uiState.steps[uiState.steps.length - 1].tool === "CLOSE"
    ) {
      setIsAgentFinished(true);
      fetch("/api/session", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: uiState.sessionId,
        }),
      });
    }
  }, [uiState.sessionId, uiState.steps]);

  useEffect(() => {
    scrollToBottom();
  }, [uiState.steps, scrollToBottom]);

  // Add a new function to process a single step
  const processStep = async (
    stepData: {
      output: Item[];
      responseId: string;
    }[],
    sessionId: string,
    stepNumber: number
  ) => {
    const hasMessage = stepData.find((step) =>
      step.output.find((item) => item.type === "message")
    );
    const hasComputerCall = stepData.find((step) =>
      step.output.find((item) => item.type === "computer_call")
    );
    const hasFunctionCall = stepData.find((step) =>
      step.output.find((item) => item.type === "function_call")
    );

    const messageItem = hasMessage?.output.find(
      (item) => item.type === "message"
    );
    const computerItem = hasComputerCall?.output.find(
      (item) => item.type === "computer_call"
    );
    const functionItem = hasFunctionCall?.output.find(
      (item) => item.type === "function_call"
    );

    if (
      !hasComputerCall && 
      !hasFunctionCall &&
      messageItem &&
      messageItem.type === "message" &&
      messageItem.content[0].type === "output_text"
    ) {
      const newStep: BrowserStep = {
        text: messageItem.content?.[0].text || "",
        reasoning: "Processing message",
        tool: "MESSAGE",
        instruction: "",
        stepNumber: stepNumber++,
        messageId: messageItem.id,
      };

      // Only add the step if we haven't seen this messageId before
      const isDuplicate = agentStateRef.current.steps.some(
        (step) =>
          step.messageId === messageItem.id && messageItem.id !== undefined
      );

      if (!isDuplicate) {
        agentStateRef.current = {
          ...agentStateRef.current,
          steps: [...agentStateRef.current.steps, newStep],
        };

        setUiState((prev) => ({
          ...prev,
          steps: agentStateRef.current.steps,
        }));
      }

      setIsWaitingForInput(true);
      currentResponseRef.current = {
        id: stepData[0].responseId,
      };

      // Focus the input when it becomes visible
      if (inputRef.current) {
        inputRef.current.focus();
      }
    } else if (computerItem || functionItem) {
      if (
        messageItem &&
        messageItem.type === "message" &&
        messageItem.content[0].type === "output_text"
      ) {
        const newStep: BrowserStep = {
          text: messageItem.content?.[0].text || "",
          reasoning: "Processing message",
          tool: "MESSAGE",
          instruction: "",
          stepNumber: stepNumber++,
          messageId: messageItem.id,
        };

        // Only add the step if we haven't seen this messageId before
        const isDuplicate = agentStateRef.current.steps.some(
          (step) =>
            step.messageId === messageItem.id && messageItem.id !== undefined
        );

        if (!isDuplicate) {
          agentStateRef.current = {
            ...agentStateRef.current,
            steps: [...agentStateRef.current.steps, newStep],
          };

          setUiState((prev) => ({
            ...prev,
            steps: agentStateRef.current.steps,
          }));
        }
      }
      let actionStep: BrowserStep | null = null;

      if (computerItem) {
        const action = computerItem.action;

        switch (action.type) {
          case "click":
            actionStep = {
              text: `Clicking at position (${action.x}, ${action.y})`,
              reasoning: "Executing mouse click action",
              tool: "CLICK",
              instruction: `click(${action.x}, ${action.y})`,
              stepNumber: stepNumber++,
            };
            break;
          case "type":
            actionStep = {
              text: `Typing text: "${action.text}"`,
              reasoning: "Entering text input",
              tool: "TYPE",
              instruction: action.text || "",
              stepNumber: stepNumber++,
            };
            break;
          case "keypress":
            actionStep = {
              text: `Pressing keys: ${action.keys?.join(", ")}`,
              reasoning: "Executing keyboard action",
              tool: "KEYPRESS",
              instruction: action.keys?.join(", ") || "",
              stepNumber: stepNumber++,
            };
            break;
          case "scroll":
            actionStep = {
              text: `Scrolling by (${action.scroll_x}, ${action.scroll_y})`,
              reasoning: "Adjusting page view",
              tool: "SCROLL",
              instruction: `scroll(${action.scroll_x}, ${action.scroll_y})`,
              stepNumber: stepNumber++,
            };
            break;
          default:
            actionStep = {
              text: `Performing ${action.type} action`,
              reasoning: "Executing browser action",
              tool: "ACT",
              instruction: action.type,
              stepNumber: stepNumber++,
            };
        }
      } else if (functionItem) {
        switch (functionItem.name) {
          case "back":
            actionStep = {
              text: "Going back",
              reasoning: "Going back",
              tool: "NAVBACK",
              instruction: "back()",
              stepNumber: stepNumber++,
            };
            break;
          case "goto":
            actionStep = {
              text: `Navigating to ${JSON.parse(functionItem.arguments).url}`,
              reasoning: "Navigating to URL",
              tool: "GOTO",
              instruction: `goto(${JSON.parse(functionItem.arguments).url})`,
              stepNumber: stepNumber++,
            };
            break;
        }
      }
      agentStateRef.current = {
        ...agentStateRef.current,
        steps: [...agentStateRef.current.steps, actionStep ?? {
          text: "Unknown action",
          reasoning: "Default action",
          tool: "ACT",
          instruction: "",
          stepNumber: stepNumber++
        }],
      };

      setUiState((prev) => ({
        ...prev,
        steps: agentStateRef.current.steps,
      }));

      // Handle computer call
      const computerCallResponse = await fetch("/api/operator/step/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          output: hasComputerCall ?? hasFunctionCall,
        }),
      });

      const computerCallData: (
        | Message
        | FunctionOutput
        | ComputerCallOutput
      )[] = await computerCallResponse.json();

      const nextStepResponse = await fetch("/api/operator/step/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          input: computerCallData,
          responseId: stepData[0].responseId,
        }),
      });

      const nextStepData = await nextStepResponse.json();
      currentResponseRef.current = {
        id: nextStepData[0].responseId,
      };

      // Process the next step recursively
      return processStep(nextStepData, sessionId, stepNumber);
    } else {
      console.log("No message or computer call output");
      console.log("messageItem", messageItem);
      console.log("computerItem", computerItem);
    }
  };

  // Update the handleUserInput function
  const handleUserInput = useCallback(async (input: string) => {
    if (!input.trim()) return;

    // Add user message to chat
    const userStep: BrowserStep = {
      text: input,
      reasoning: "User input",
      tool: "MESSAGE",
      instruction: "",
      stepNumber: agentStateRef.current.steps.length + 1,
    };

    agentStateRef.current = {
      ...agentStateRef.current,
      steps: [...agentStateRef.current.steps, userStep],
    };

    setUiState((prev) => ({
      ...prev,
      steps: agentStateRef.current.steps,
    }));

    setIsWaitingForInput(false);

    setUserInput("");

    try {
      // Continue the conversation
      const nextStepResponse = await fetch("/api/operator/step/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: agentStateRef.current.sessionId,
          responseId: currentResponseRef.current?.id,
          input: [
            {
              role: "user",
              content: input,
            },
          ],
        }),
      });

      const nextStepData = await nextStepResponse.json();
      currentResponseRef.current = {
        id: nextStepData[0].responseId,
      };

      const stepNumber = agentStateRef.current.steps.length + 1;

      if (agentStateRef.current.sessionId) {
        // Process the next step recursively
        return processStep(
          nextStepData,
          agentStateRef.current.sessionId,
          stepNumber
        );
      }
    } catch (error) {
      console.error("Error handling user input:", error);
      // Add error message to chat
      const errorStep: BrowserStep = {
        text: "Sorry, there was an error processing your request. Please try again.",
        reasoning: "Error handling user input",
        tool: "MESSAGE",
        instruction: "",
        stepNumber: agentStateRef.current.steps.length + 1,
      };

      agentStateRef.current = {
        ...agentStateRef.current,
        steps: [...agentStateRef.current.steps, errorStep],
      };

      setUiState((prev) => ({
        ...prev,
        steps: agentStateRef.current.steps,
      }));

      setUserInput("");

      setIsWaitingForInput(true);
      return null;
    }
  }, []);

  // Add currentResponseRef to store the current response
  const currentResponseRef = useRef<{ id: string } | null>(null);

  // Update the initialization function
  useEffect(() => {
    console.log("useEffect called");
    const initializeSession = async () => {
      if (initializationRef.current) return;
      initializationRef.current = true;

      if (initialMessage && !agentStateRef.current.sessionId) {
        setIsLoading(true);
        try {
          const sessionResponse = await fetch("/api/session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
            }),
          });
          const sessionData = await sessionResponse.json();

          if (!sessionData.success) {
            throw new Error(sessionData.error || "Failed to create session");
          }

          agentStateRef.current = {
            ...agentStateRef.current,
            sessionId: sessionData.sessionId,
            sessionUrl: sessionData.sessionUrl.replace(
              "https://www.browserbase.com/devtools-fullscreen/inspector.html",
              "https://www.browserbase.com/devtools-internal-compiled/index.html"
            ),
            connectUrl: sessionData.connectUrl,
          };

          setUiState({
            sessionId: sessionData.sessionId,
            sessionUrl: sessionData.sessionUrl.replace(
              "https://www.browserbase.com/devtools-fullscreen/inspector.html",
              "https://www.browserbase.com/devtools-internal-compiled/index.html"
            ),
            connectUrl: sessionData.connectUrl,
            steps: [],
          });

          // Start the operator session
          const startResponse = await fetch("/api/operator/start", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              sessionId: sessionData.sessionId,
              userInput: initialMessage,
            }),
          });

          const startData: {
            output: Item[];
            responseId: string;
          }[] = await startResponse.json();

          posthog.capture("operator_start", {
            goal: initialMessage,
            sessionId: sessionData.sessionId
          });

          if (startData) {
            const stepNumber = 1;

            // Process the first step and continue with subsequent steps
            await processStep(startData, sessionData.sessionId, stepNumber);
          }
        } catch (error) {
          console.error("Session initialization error:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    initializeSession();
  }, [initialMessage, handleUserInput]);

  // Spring configuration for smoother animations
  const springConfig = {
    type: "spring",
    stiffness: 350,
    damping: 30,
  };

  const containerVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        ...springConfig,
        staggerChildren: 0.1,
      },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.2 },
    },
  };

  const messageVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <motion.div
      className="min-h-screen bg-gray-50 flex flex-col"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <motion.nav
        className="flex justify-between items-center px-8 py-4 bg-white border-b border-gray-200 shadow-sm"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-2">
          <Image
            src="/favicon.svg"
            alt="CUA Browser"
            className="w-8 h-8"
            width={32}
            height={32}
          />
          <span className="font-ppsupply text-gray-900">www.browserbase.com/computer-use</span>
        </div>
        <motion.button
          onClick={onClose}
          className="px-4 py-2 hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors rounded-md font-ppsupply flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Close
          {!isMobile && (
            <kbd className="px-2 py-1 text-xs bg-gray-100 rounded-md">ESC</kbd>
          )}
        </motion.button>
      </motion.nav>
      <main className="flex-1 flex flex-col items-center p-6">
        <motion.div
          className="w-full max-w-[1280px] bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="w-full h-12 bg-white border-b border-gray-200 flex items-center px-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
            </div>
          </div>

          {(() => {
            console.log("Session URL:", uiState.sessionUrl);
            return null;
          })()}

          <div className="flex flex-col md:flex-row">
            {uiState.sessionUrl && !isAgentFinished && (
              <div className="flex-1 p-6 border-b md:border-b-0 md:border-l border-gray-200 order-first md:order-last">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="w-full aspect-video"
                >
                  <iframe
                    src={uiState.sessionUrl}
                    className="w-full h-full"
                    sandbox="allow-same-origin allow-scripts allow-forms"
                    allow="clipboard-read; clipboard-write"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    title="Browser Session"
                  />
                </motion.div>
              </div>
            )}

            {isAgentFinished && (
              <div className="flex-1 p-6 border-b md:border-b-0 md:border-l border-gray-200 order-first md:order-last">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="w-full aspect-video"
                >
                  <div className="w-full h-full border border-gray-200 rounded-lg flex items-center justify-center">
                    <p className="text-gray-500 text-center">
                      The agent has completed the task
                      <br />
                      &quot;{initialMessage}&quot;
                    </p>
                  </div>
                </motion.div>
              </div>
            )}

            <div className="md:w-[400px] p-6 min-w-0 md:h-[calc(56.25vw-3rem)] md:max-h-[calc(100vh-12rem)] flex flex-col">
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto space-y-4"
              >
                {initialMessage && (
                  <motion.div
                    variants={messageVariants}
                    className="p-4 bg-blue-50 rounded-lg font-ppsupply"
                  >
                    <p className="font-semibold">Goal:</p>
                    <p>{initialMessage}</p>
                  </motion.div>
                )}

                {uiState.steps.map((step, index) => (
                  <motion.div
                    key={index}
                    variants={messageVariants}
                    className="p-4 bg-white border border-gray-200 rounded-lg font-ppsupply space-y-2"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        Step {step.stepNumber}
                      </span>
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {step.tool}
                      </span>
                    </div>
                    <p className="font-medium">{step.text}</p>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold">Reasoning: </span>
                      {step.reasoning}
                    </p>
                  </motion.div>
                ))}
                {isLoading && (
                  <motion.div
                    variants={messageVariants}
                    className="p-4 bg-gray-50 rounded-lg font-ppsupply animate-pulse"
                  >
                    Processing...
                  </motion.div>
                )}
              </div>

              {/* Chat Input */}
              {isWaitingForInput && !isAgentFinished && (
                <motion.form
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      ["quit", "exit", "bye"].includes(userInput.toLowerCase())
                    ) {
                      setIsAgentFinished(true);
                      return;
                    }
                    await handleUserInput(userInput);
                  }}
                  className="mt-4 flex gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF3B00] focus:border-transparent font-ppsupply animate-[pulseInput_2s_ease-in-out_infinite] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!userInput.trim()}
                    className="px-4 py-2 bg-[#FF3B00] text-white rounded-lg font-ppsupply disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E63500] transition-colors"
                  >
                    Send
                  </button>
                </motion.form>
              )}
            </div>
          </div>
        </motion.div>
      </main>
      <style jsx global>{`
        ${pulseInputKeyframes}
      `}</style>
    </motion.div>
  );
}
