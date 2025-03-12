"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SessionControls } from "./SessionControls";
import { RotateCcwIcon } from "lucide-react";

interface BrowserSessionContainerProps {
  sessionUrl: string | null;
  isVisible: boolean;
  isCompleted: boolean;
  initialMessage: string | undefined;
  sessionTime?: number;
  onStop?: () => void;
  onRestart?: () => void;
}

const containerVariants = {
  hidden: {
    opacity: 0,
    y: 20,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
      mass: 1,
      delay: 0.2,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    transition: {
      duration: 0.3,
      ease: "easeInOut",
    },
  },
};

const leftCurtainVariants = {
  hidden: { x: "-100%" },
  visible: {
    x: "-100%",
    transition: {
      duration: 0,
    },
  },
  open: {
    x: "-100%",
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 20,
      delay: 0.2,
    },
  },
  close: {
    x: "0%",
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 20,
    },
  },
};

const rightCurtainVariants = {
  hidden: { x: "100%" },
  visible: {
    x: "100%",
    transition: {
      duration: 0,
    },
  },
  open: {
    x: "100%",
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 20,
      delay: 0.2,
    },
  },
  close: {
    x: "0%",
    transition: {
      type: "spring",
      stiffness: 120,
      damping: 20,
    },
  },
};

const BrowserSessionContainer: React.FC<BrowserSessionContainerProps> = ({
  sessionUrl,
  isVisible,
  isCompleted,
  initialMessage,
  sessionTime = 0,
  onStop = () => {},
  onRestart = () => {},
}) => {
  // Track the animation state of curtains
  const [curtainState, setCurtainState] = useState<
    "closed" | "opening" | "open" | "closing"
  >("closed");

  // Handle curtain animation based on session state
  useEffect(() => {
    if (isVisible) {
      if (!sessionUrl && !isCompleted) {
        // Session is starting, curtains closed initially
        setCurtainState("closed");
      } else if (sessionUrl && !isCompleted) {
        // Session URL is available, but wait 1 second before opening the curtains
        const openTimer = setTimeout(() => {
          setCurtainState("opening");
          // After animation delay, set to fully open
          const openCompleteTimer = setTimeout(
            () => setCurtainState("open"),
            800
          );
          return () => clearTimeout(openCompleteTimer);
        }, 1000); // Wait 1 second before starting to open

        return () => clearTimeout(openTimer);
      } else if (isCompleted) {
        // Session is completed, close the curtains
        setCurtainState("closing");
      }
    }
  }, [isVisible, sessionUrl, isCompleted]);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          className="w-full mx-auto flex flex-col md:justify-center"
          style={{ minHeight: "auto" }}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          key={isCompleted ? "completed" : "active"}
        >
          {/* Browser frame */}
          <div
            className="w-full h-[540px] md:h-[90vh] flex items-center justify-center overflow-hidden border border-[#333333] shadow-sm relative rounded-lg"
            style={{
              backgroundColor: "rgba(25, 25, 25, 0.75)",
              backdropFilter: "blur(8px)",
            }}
          >
            {/* Always visible timer and controls */}
            {!isCompleted && sessionUrl && (
              <div className="absolute top-4 right-4 z-20">
                <SessionControls
                  sessionTime={sessionTime}
                  onStop={onStop}
                />
              </div>
            )}
            {/* Left Curtain */}
            <motion.div
              className="absolute top-0 left-0 w-1/2 h-full z-10"
              style={{
                backgroundColor: "#9333ea",
              }}
              variants={leftCurtainVariants}
              initial="visible"
              animate={
                curtainState === "opening" || curtainState === "open"
                  ? "open"
                  : "close"
              }
            />

            {/* Right Curtain */}
            <motion.div
              className="absolute top-0 right-0 w-1/2 h-full z-10"
              style={{
                backgroundColor: "#9333ea",
              }}
              variants={rightCurtainVariants}
              initial="visible"
              animate={
                curtainState === "opening" || curtainState === "open"
                  ? "open"
                  : "close"
              }
            />
            {/* Browser Content */}
            {!isCompleted ? (
              sessionUrl ? (
                <iframe
                  src={sessionUrl}
                  className="w-full h-full border-none absolute inset-0"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  allow="clipboard-read; clipboard-write"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  title="Browser Session"
                />
              ) : (
                <div
                  className="w-full h-full flex flex-col items-center justify-center p-6 space-y-4"
                >
                  <div className="animate-pulse">
                    <div className="w-12 h-12 rounded-full bg-[#111111] border-2 border-[#ff00bf] flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-[#ff00bf]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-white">
                    Starting New Session
                  </h3>
                  <p className="text-center text-gray-300 max-w-md">
                    {initialMessage
                      ? `Goal: ${initialMessage}`
                      : "Initializing browser session..."}
                  </p>
                </div>
              )
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center p-6 space-y-4"
              >
                <div className="animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-[#ff00bf] flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-white">
                  Session Complete
                </h3>
                <p className="text-center text-gray-300 max-w-md">
                  The browser session has been completed. You can restart with a
                  new goal or close this session.
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={onRestart}
                    className="flex items-center px-4 py-2 bg-black text-[#ff00bf] border border-[#ff00bf] rounded-lg hover:bg-[#ff00bf] hover:text-white transition-colors"
                  >
                    <RotateCcwIcon size={16} className="mr-2" />
                    New Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BrowserSessionContainer;
