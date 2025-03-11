"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import React from "react";
import { useWindowSize } from "usehooks-ts";
import Image from "next/image";
import posthog from "posthog-js";
import {
  FunctionOutput,
  Item,
  ComputerCallOutput,
  OutputText,
} from "../api/cua/agent/types";
import { SlidingNumber } from "../components/ui/sliding-number";

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
    | "SCROLL"
    | "DOUBLECLICK"
    | "DRAG"
    | "SCREENSHOT"
    | "MOVE";
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

const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    // Only show seconds if less than a minute
    return seconds.toString();
  }
  // Show minutes:seconds format once we reach 1 minute or more
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes.toString()}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
};

// Generate detailed reasoning for actions based on context and action type
const generateDetailedReasoning = (
  action: Record<string, unknown>,
  actionType: string,
  contextClues: Record<string, unknown>,
  createTaskDescription: (
    action: Record<string, unknown>,
    actionType: string
  ) => string
): string => {
  // Get basic description first
  const basicDescription = createTaskDescription(action, actionType);

  // Add more detailed context based on the action type and available context
  switch (actionType) {
    case "click":
      if (contextClues.goal) {
        return `${basicDescription} to begin searching for information about ${contextClues.goal}. This interaction initiates the search process.`;
      }
      return `${basicDescription} to interact with the page interface. This helps navigate through the content to find the requested information.`;

    case "type":
      const text = action.text || "";
      if (contextClues.goal) {
        return `${basicDescription} to search for specific information about ${contextClues.goal}. Entering these search terms will help retrieve relevant results.`;
      }
      return `${basicDescription} to provide input needed for this search. This text will help narrow down the results to find the specific information requested.`;

    case "keypress":
      const keys = Array.isArray(action.keys) ? action.keys.join(", ") : "";
      if (keys.includes("ENTER")) {
        return `Submitting the search query to find information about ${
          contextClues.goal || "the requested topic"
        }. This will execute the search and retrieve relevant results.`;
      }
      return `${basicDescription} to efficiently interact with the page. This keyboard interaction helps streamline the navigation process.`;

    case "scroll":
      return `${basicDescription} to view additional content that might contain the requested information about ${
        contextClues.goal || "the topic"
      }. Scrolling allows examining more search results or content.`;

    case "goto":
      let domain = "";
      try {
        if (action.url) {
          domain = new URL(action.url as string).hostname.replace("www.", "");
        }
      } catch (e) {}

      return `${basicDescription} to find information about ${
        contextClues.goal || "the requested topic"
      }. This website likely contains relevant data or search capabilities needed.`;

    case "back":
      return `${basicDescription} to return to previous content. This helps with navigation when the current page doesn't contain the needed information.`;

    case "wait":
      return `${basicDescription} while the page loads the requested information. This ensures all content is properly displayed before proceeding.`;

    case "double_click":
      return `${basicDescription} to interact with this element. Double-clicking often opens or expands content that may contain relevant information.`;

    case "drag":
      // Get start and end points from the path if available
      let startPoint = { x: 0, y: 0 };
      let endPoint = { x: 0, y: 0 };
      if (Array.isArray(action.path) && action.path.length > 0) {
        startPoint = action.path[0] as { x: number; y: number };
        endPoint = action.path[action.path.length - 1] as {
          x: number;
          y: number;
        };
      }
      return `${basicDescription} to adjust the view or interact with content. Dragging from (${startPoint.x}, ${startPoint.y}) to (${endPoint.x}, ${endPoint.y}) helps reveal or organize information in a more useful way.`;

    case "screenshot":
      return `${basicDescription} to capture the visual information displayed. This preserves the current state of the information for reference.`;

    case "move":
      return `${basicDescription} to prepare for the next interaction. Positioning the cursor is necessary before clicking or selecting content.`;

    case "message":
      if (
        typeof action.text === "string" &&
        (action.text.startsWith("yes") ||
          action.text.startsWith("no") ||
          action.text.includes("?"))
      ) {
        return `Providing additional input to refine the search for information about ${
          contextClues.goal || "the requested topic"
        }. This clarification helps the assistant provide more relevant results.`;
      }
      return `Communicating with the assistant about ${
        contextClues.goal || "the requested information"
      }. This exchange helps clarify needs and receive appropriate information.`;

    default:
      return `${basicDescription} to progress in finding information about ${
        contextClues.goal || "the requested topic"
      }. This action is part of the process to retrieve the relevant data.`;
  }
};

export default function LegacyChatFeed({
  initialMessage,
  onClose,
}: ChatFeedProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
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
    let timer: NodeJS.Timeout | null = null;

    if (uiState.sessionId) {
      // Reset timer when a new session starts
      setSessionTime(0);

      // Start the timer
      timer = setInterval(() => {
        setSessionTime((prevTime) => prevTime + 1);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [uiState.sessionId]);

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
  const processStep = useCallback(
    async (
      stepData: {
        output: Item[];
        responseId: string;
      }[],
      sessionId?: string,
      stepNumber = 1
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

      // Extract context from message content
      const contextClues = {
        website: "",
        action: "",
        subject: "",
        location: "",
        filter: "",
        selection: "",
        goal: "", // The overall user goal
        lastAction: "", // Keep track of the previous action
      };

      // Extract context from message content if available
      if (
        messageItem &&
        messageItem.type === "message" &&
        messageItem.content
      ) {
        // Extract text from content items
        const messageText =
          messageItem.content
            .filter((content) => content.type === "output_text")
            .map((content) => (content as OutputText).text)
            .join(" ") || "";

        // Look for goal statements
        const goalPatterns = [
          /(?:I want to|I'd like to|I need to|Can you|Please)\s+([^.?!]+)[.?!]/i,
          /(?:find|search|look up|tell me|show me)\s+([^.?!]+)[.?!]/i,
          /(?:what is|how much|how many|where is|when is)\s+([^.?!]+)[?]/i,
        ];

        // Extract website names
        const websitePatterns = [
          /(?:on|to|using|visit|open|access|browse)\s+([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+)/i,
          /([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+)\s+(?:website|site|page)/i,
          /(?:website|site|page)\s+([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)+)/i,
        ];

        // Extract search terms
        const searchPatterns = [
          /(?:search|look|find)(?:\s+for)?\s+([^.,;]+)/i,
          /searching\s+for\s+([^.,;]+)/i,
        ];

        // Extract location information
        const locationPatterns = [
          /(?:in|near|at|around)\s+([A-Za-z\s]+(?:City|Town|Village|County|State|Province|District|Area|Region))/i,
          /location\s+(?:in|near|at|to)\s+([^.,;]+)/i,
          /([A-Za-z\s]+(?:City|Town|Village|County|State|Province|District|Area|Region))/i,
        ];

        // Extract filter information
        const filterPatterns = [
          /filter\s+(?:by|for|with)\s+([^.,;]+)/i,
          /(?:set|adjust|change)\s+(?:the)?\s+([^\s]+)\s+(?:filter|setting|option)\s+(?:to|for)?\s+([^.,;]+)/i,
        ];

        // Extract selection information
        const selectionPatterns = [
          /(?:select|choose|pick)\s+(?:the)?\s+([^.,;]+)/i,
          /selecting\s+(?:the)?\s+([^.,;]+)/i,
        ];

        // Apply all patterns to extract context
        for (const pattern of goalPatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.goal = match[1].trim();
            break;
          }
        }

        for (const pattern of websitePatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.website = match[1].trim();
            break;
          }
        }

        for (const pattern of searchPatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.subject = match[1].trim();
            break;
          }
        }

        for (const pattern of locationPatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.location = match[1].trim();
            break;
          }
        }

        for (const pattern of filterPatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.filter = match[1].trim();
            if (match[2]) contextClues.filter += " " + match[2].trim();
            break;
          }
        }

        for (const pattern of selectionPatterns) {
          const match = messageText.match(pattern);
          if (match && match[1]) {
            contextClues.selection = match[1].trim();
            break;
          }
        }

        // Determine the main action from the message
        if (messageText.match(/search|find|look/i)) {
          contextClues.action = "searching";
        } else if (messageText.match(/select|choose|pick/i)) {
          contextClues.action = "selecting";
        } else if (messageText.match(/filter|adjust|set/i)) {
          contextClues.action = "filtering";
        } else if (messageText.match(/click|press|tap/i)) {
          contextClues.action = "clicking";
        } else if (messageText.match(/type|enter|input|fill/i)) {
          contextClues.action = "entering";
        } else if (messageText.match(/scroll|move/i)) {
          contextClues.action = "scrolling";
        }
      }

      // Create a concise, task-oriented reasoning description
      const createTaskDescription = (
        action: Record<string, unknown>,
        actionType: string
      ): string => {
        // Default descriptions based on action type
        const defaultDescriptions: Record<string, string> = {
          click: "Clicking on an element",
          type: "Entering text",
          keypress: "Pressing keyboard keys",
          scroll: "Scrolling the page",
          goto: "Navigating to a website",
          back: "Going back to previous page",
          wait: "Waiting for page to load",
          double_click: "Double-clicking on an element",
          drag: "Dragging an element",
          screenshot: "Taking a screenshot",
          move: "Moving the cursor",
          message: "Sending a message",
        };

        // Get domain from URL for goto actions
        let domain = "";
        if (actionType === "goto" && typeof action.url === "string") {
          try {
            domain = new URL(action.url).hostname.replace("www.", "");
          } catch (e) {
            // If URL parsing fails, just use the default
          }
        }

        // Create specific descriptions based on context
        switch (actionType) {
          case "click":
            // Try to infer what's being clicked based on common UI patterns
            const x = typeof action.x === "number" ? action.x : 0;
            const y = typeof action.y === "number" ? action.y : 0;

            if (typeof action.x === "number" && typeof action.y === "number") {
              // Check if clicking in top-left corner (often navigation/menu)
              if (x < 100 && y < 100) {
                return "Opening navigation menu";
              }
              // Check if clicking in top-right corner (often account/settings)
              else if (x > 900 && y < 100) {
                return "Accessing account options";
              }
              // Check if clicking near bottom of page (often pagination/load more)
              else if (y > 500) {
                return "Loading more content";
              }
            }

            return "Selecting an interactive element";
          case "type":
            const text = typeof action.text === "string" ? action.text : "";
            if (text.includes("@") && text.includes("."))
              return "Entering email address";
            if (text.length > 20) return "Entering detailed information";
            if (/^\d+$/.test(text)) return "Entering numeric value";
            return text
              ? `Typing "${text.substring(0, 15)}${
                  text.length > 15 ? "..." : ""
                }"`
              : defaultDescriptions.type;
          case "keypress":
            const keys = Array.isArray(action.keys)
              ? action.keys.join(", ")
              : "";
            if (keys.includes("Enter")) return "Submitting form";
            if (keys.includes("Tab")) return "Moving to next field";
            if (keys.includes("Escape")) return "Closing dialog";
            return defaultDescriptions.keypress;
          case "scroll":
            const scrollY =
              typeof action.scroll_y === "number" ? action.scroll_y : 0;
            return scrollY > 0
              ? "Scrolling down to see more results"
              : "Scrolling up to previous content";
          case "goto":
            return domain ? `Accessing ${domain}` : defaultDescriptions.goto;
          case "back":
            return "Going back to previous page";
          case "wait":
            // Provide more specific wait descriptions
            if (contextClues.action === "searching") {
              return `Waiting for search results to load`;
            } else if (contextClues.website) {
              return `Waiting for ${contextClues.website} page to load`;
            } else if (contextClues.subject) {
              return `Waiting for ${contextClues.subject} content to appear`;
            }
            return "Waiting for page to respond";
          default:
            // For other action types, try to be more specific based on context
            if (actionType === "doubleclick" && contextClues.selection) {
              return `Opening ${contextClues.selection}`;
            } else if (actionType === "drag" && contextClues.action) {
              return `Adjusting ${contextClues.action} by dragging`;
            } else if (actionType === "screenshot") {
              return "Capturing screenshot of current view";
            } else if (actionType === "move" && contextClues.action) {
              return `Positioning cursor for ${contextClues.action}`;
            }
            return (
              defaultDescriptions[actionType] ||
              `Performing ${actionType} action`
            );
        }
      };

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
                reasoning: generateDetailedReasoning(
                  action,
                  "click",
                  contextClues,
                  createTaskDescription
                ),
                tool: "CLICK",
                instruction: `click(${action.x}, ${action.y})`,
                stepNumber: stepNumber++,
              };
              break;
            case "type":
              actionStep = {
                text: `Typing text: "${action.text}"`,
                reasoning: generateDetailedReasoning(
                  action,
                  "type",
                  contextClues,
                  createTaskDescription
                ),
                tool: "TYPE",
                instruction: action.text || "",
                stepNumber: stepNumber++,
              };
              break;
            case "keypress":
              actionStep = {
                text: `Pressing keys: ${action.keys?.join(", ")}`,
                reasoning: generateDetailedReasoning(
                  action,
                  "keypress",
                  contextClues,
                  createTaskDescription
                ),
                tool: "KEYPRESS",
                instruction: action.keys?.join(", ") || "",
                stepNumber: stepNumber++,
              };
              break;
            case "scroll":
              actionStep = {
                text: `Scrolling by (${action.scroll_x}, ${action.scroll_y})`,
                reasoning: generateDetailedReasoning(
                  action,
                  "scroll",
                  contextClues,
                  createTaskDescription
                ),
                tool: "SCROLL",
                instruction: `scroll(${action.scroll_x}, ${action.scroll_y})`,
                stepNumber: stepNumber++,
              };
              break;
            default:
              // Create more specific text descriptions for different action types
              let actionText = `Performing ${action.type} action`;

              if (action.type === "wait") {
                actionText = "Waiting for page to respond";
              } else if (action.type === "double_click") {
                actionText = `Double-clicking at position (${action.x || 0}, ${
                  action.y || 0
                })`;
              } else if (action.type === "drag") {
                // Drag has a path array with start and end points
                const startPoint = action.path?.[0] || { x: 0, y: 0 };
                const endPoint = action.path?.[action.path?.length - 1] || {
                  x: 0,
                  y: 0,
                };
                actionText = `Dragging from (${startPoint.x}, ${startPoint.y}) to (${endPoint.x}, ${endPoint.y})`;
              } else if (action.type === "screenshot") {
                actionText = "Taking screenshot of current page";
              } else if (action.type === "move") {
                actionText = `Moving cursor to position (${action.x || 0}, ${
                  action.y || 0
                })`;
              }

              actionStep = {
                text: actionText,
                reasoning: generateDetailedReasoning(
                  action,
                  action.type,
                  contextClues,
                  createTaskDescription
                ),
                tool: action.type.toUpperCase() as unknown as
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
                  | "SCROLL"
                  | "DOUBLECLICK"
                  | "DRAG"
                  | "SCREENSHOT"
                  | "MOVE",
                instruction: action.type,
                stepNumber: stepNumber++,
              };
          }
        } else if (functionItem) {
          switch (functionItem.name) {
            case "back":
              actionStep = {
                text: "Going back to the previous page",
                reasoning: generateDetailedReasoning(
                  {},
                  "back",
                  contextClues,
                  createTaskDescription
                ),
                tool: "NAVBACK",
                instruction: "back()",
                stepNumber: stepNumber++,
              };
              break;
            case "goto":
              const gotoArgs = JSON.parse(functionItem.arguments);
              actionStep = {
                text: `Navigating to ${gotoArgs.url}`,
                reasoning: generateDetailedReasoning(
                  gotoArgs,
                  "goto",
                  contextClues,
                  createTaskDescription
                ),
                tool: "GOTO",
                instruction: `goto(${gotoArgs.url})`,
                stepNumber: stepNumber++,
              };
              break;
          }
        }
        agentStateRef.current = {
          ...agentStateRef.current,
          steps: [
            ...agentStateRef.current.steps,
            actionStep ?? {
              text: "Unknown action",
              reasoning: "Default action",
              tool: "ACT",
              instruction: "",
              stepNumber: stepNumber++,
            },
          ],
        };

        setUiState((prev) => ({
          ...prev,
          steps: agentStateRef.current.steps,
        }));

        // Handle computer call
        const computerCallResponse = await fetch("/api/cua/step/execute", {
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

        const nextStepResponse = await fetch("/api/cua/step/generate", {
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
    },
    []
  );

  // Update the handleUserInput function
  const handleUserInput = useCallback(
    async (input: string) => {
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
        const nextStepResponse = await fetch("/api/cua/step/generate", {
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
    },
    [processStep]
  );

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
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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

          // Start the cua session
          const startResponse = await fetch("/api/cua/start", {
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

          posthog.capture("cua_start", {
            goal: initialMessage,
            sessionId: sessionData.sessionId,
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
  }, [initialMessage, handleUserInput, processStep]);

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
          <span className="font-ppsupply text-gray-900">
            www.browserbase.com/computer-use
          </span>
        </div>
        <motion.button
          onClick={onClose}
          className="px-4 py-2 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-md font-ppsupply animate-[pulseInput_2s_ease-in-out_infinite] transition-all"
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
          className="w-full max-w-[1280px] bg-white border border-gray-200 shadow-sm overflow-hidden"
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
              <div className="flex-1 p-6 border-b md:border-b-0 md:border-l border-gray-200 order-first md:order-last flex items-center justify-center">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="w-full aspect-video flex flex-col items-center"
                >
                  <div className="w-full h-full flex items-center justify-center overflow-hidden border border-gray-200 shadow-sm">
                    <iframe
                      src={uiState.sessionUrl}
                      className="w-full h-full"
                      sandbox="allow-same-origin allow-scripts allow-forms"
                      allow="clipboard-read; clipboard-write"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      title="Browser Session"
                    />
                  </div>
                  <div className="mt-3 flex justify-center items-center space-x-2 text-sm text-gray-500">
                    <svg
                      className="w-4 h-4"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <div className="font-mono flex items-center">
                      Session time:{" "}
                      <span className="ml-1">{formatTime(sessionTime)}</span>
                    </div>
                  </div>
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
                  <div className="w-full h-full border border-gray-200 flex items-center justify-center">
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
                className="flex-1 overflow-hidden space-y-4 hide-scrollbar" style={{ overflowY: 'auto', overflowX: 'hidden' }}
              >
                {initialMessage && (
                  <motion.div
                    variants={messageVariants}
                    className="p-4 bg-purple-50 font-ppsupply"
                  >
                    <p className="font-semibold">Goal:</p>
                    <p>{initialMessage}</p>
                  </motion.div>
                )}

                {uiState.steps.map((step, index) => {
                  // Determine if this is a system message (like stock price info)
                  const isSystemMessage =
                    step.tool === "MESSAGE" &&
                    step.reasoning === "Processing message";
                  // Determine if this is a user input message
                  const isUserInput =
                    step.tool === "MESSAGE" && step.reasoning === "User input";
                  return (
                    <motion.div
                      key={index}
                      variants={messageVariants}
                      className={`p-4 ${
                        isUserInput
                          ? "bg-white"
                          : isSystemMessage
                          ? "bg-[#2E191E] text-white"
                          : "bg-white"
                      } border border-gray-200 font-ppsupply space-y-2`}
                    >
                      <div className="flex justify-between items-center">
                        <span
                          className={`text-sm ${
                            isSystemMessage ? "text-gray-200" : "text-gray-500"
                          }`}
                        >
                          Step {step.stepNumber}
                        </span>
                        <span
                          className={`px-2 py-1 ${
                            isSystemMessage
                              ? " text-gray-200"
                              : " text-white-200"
                          } border border-white text-xs`}
                        >
                          {step.tool}
                        </span>
                      </div>
                      <div className="font-medium">
                        {isSystemMessage && step.tool === "MESSAGE" ? (
                          <>
                            {(() => {
                              // Check if this is a message with a question
                              if (step.text.includes("?")) {
                                // Find all sentences that end with a question mark
                                const sentences = step.text.match(
                                  /[^.!?]+[.!?]+/g
                                ) || [step.text];

                                // Separate questions from non-questions
                                const questions = sentences.filter((s) =>
                                  s.trim().endsWith("?")
                                );
                                const nonQuestions = sentences.filter(
                                  (s) => !s.trim().endsWith("?")
                                );

                                // Join non-questions as the answer
                                const answerText = nonQuestions.join(" ").trim();

                                // Join questions as the question
                                const questionText = questions.join(" ").trim();
                                
                                // Check if the entire message is just a question
                                const isOnlyQuestion = step.text.trim() === questionText;
                                
                                // Extract answer content from the message or find it in previous steps
                                let displayAnswerText = answerText;
                                
                                // If there's no answer content but there is a question
                                if (!displayAnswerText && questionText) {
                                  // First, check if this step has a specific answer marker
                                  if (step.text.includes("ANSWER:")) {
                                    const answerParts = step.text.split("ANSWER:");
                                    if (answerParts.length > 1) {
                                      // Extract the text after "ANSWER:" and before any "QUESTION" marker
                                      let extractedAnswer = answerParts[1].trim();
                                      if (extractedAnswer.includes("QUESTION")) {
                                        extractedAnswer = extractedAnswer.split("QUESTION")[0].trim();
                                      }
                                      if (extractedAnswer) {
                                        displayAnswerText = extractedAnswer;
                                      }
                                    }
                                  }
                                  
                                  // If we still don't have an answer, look for the first message step
                                  if (!displayAnswerText) {
                                    // Look for relevant information in previous steps
                                    const previousSteps = uiState.steps.slice(0, index);
                                    
                                    // Find the first informative MESSAGE step that's not a question
                                    const infoStep = previousSteps.find(s => 
                                      s.tool === "MESSAGE" && 
                                      s.text && 
                                      !s.text.includes("?") && // Not a question
                                      s.text.length > 10
                                    );
                                    
                                    if (infoStep) {
                                      // Use the content from the informative step
                                      displayAnswerText = infoStep.text;
                                    } else {
                                      // Default message if no relevant info found
                                      displayAnswerText = "I'm currently searching for this information. The results will be displayed here when available.";
                                    }
                                  }
                                } else if (!displayAnswerText) {
                                  // For other cases with no answer content
                                  displayAnswerText = step.text;
                                }

                                // Only render the answer part in this message block
                                return (
                                  <div className="mb-3">
                                    <div className="text-xs font-semibold text-gray-200 mb-1">
                                      ANSWER:
                                    </div>
                                    <div className="p-2">
                                      <span>{displayAnswerText}</span>
                                    </div>
                                  </div>
                                );
                              } else {
                                // For regular messages without questions, format them as answers
                                return (
                                  <div className="mb-3">
                                    {/* <div className="text-xs font-semibold text-gray-200 mb-1">
                                      ANSWER:
                                    </div> */}
                                    <div className="p-2 ">
                                      <span>{step.text}</span>
                                    </div>
                                  </div>
                                );
                              }
                            })()}
                          </>
                        ) : (
                          step.text
                        )}
                      </div>
                      {/* Show reasoning for all steps except the last one */}
                      {(!isSystemMessage ||
                        index < uiState.steps.length - 1) && (
                        <p className="text-sm text-white-200">
                          <span className="font-semibold">Reasoning: </span>
                          {step.reasoning}
                        </p>
                      )}
                    </motion.div>
                  );
                })}

                {/* Add a separate question message if the last message had a question */}
                {uiState.steps.length > 0 && (() => {
                  const lastStep = uiState.steps[uiState.steps.length - 1];
                  if (lastStep.tool === "MESSAGE" && lastStep.text.includes("?")) {
                    // Find all sentences that end with a question mark
                    const sentences = lastStep.text.match(/[^.!?]+[.!?]+/g) || [lastStep.text];
                    
                    // Extract questions
                    const questions = sentences.filter(s => s.trim().endsWith("?"));
                    const questionText = questions.join(" ").trim();
                    
                    // Check if the entire message is just a question
                    const isOnlyQuestion = lastStep.text.trim() === questionText;
                    
                    if (questionText) {
                      return (
                        <motion.div
                          variants={messageVariants}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5, duration: 0.3 }}
                          className={`p-4 bg-[#2E191E] text-white font-ppsupply space-y-2 mt-2`}
                        >
                          <div className="flex justify-between items-center">
                            {/* <span className="text-sm text-gray-200">
                              {isOnlyQuestion ? "Question" : "Follow-up"}
                            </span> */}
                            {/* <span className="px-2 py-1 text-gray-200 rounded text-xs">
                              QUESTION
                            </span> */}
                          </div>
                          <div className="font-medium">
                            <div className="p-2 border-l-2 ">
                              <span>{questionText}</span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    }
                  }
                  return null;
                })()}
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
                    className="flex-1 px-4 py-2 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#FF3B00] focus:border-transparent font-ppsupply animate-[pulseInput_2s_ease-in-out_infinite] transition-all"
                  />
                  <button
                    type="submit"
                    disabled={!userInput.trim()}
                    className="px-4 py-2 bg-[#FF3B00] text-white font-ppsupply disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#E63500] transition-colors"
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
