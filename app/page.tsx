"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AnimatedButton from "./components/AnimatedButton";
import Image from "next/image";
import posthog from "posthog-js";
import ChatFeed from "./components/ChatFeed";
import { Code, Gamepad2, Layers, Table, TrendingUp } from "lucide-react";

const Tooltip = ({
  children,
  text,
}: {
  children: React.ReactNode;
  text: string;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {children}
      <AnimatePresence>
        {isHovered && (
          <motion.span
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 3, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 400,
              damping: 17,
            }}
            className="absolute w-auto px-3 py-2 min-w-max left-1/2 -translate-x-1/2 bg-[#1a1a1a] text-white text-xs font-ppsupply z-50 backdrop-blur-sm"
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function Home() {
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [initialMessage, setInitialMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle CMD+Enter to submit the form when chat is not visible
      if (!isChatVisible && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        const form = document.querySelector("form") as HTMLFormElement;
        if (form) {
          form.requestSubmit();
        }
      }

      // Handle CMD+K to focus input when chat is not visible
      if (!isChatVisible && (e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = document.querySelector(
          'input[name="message"]'
        ) as HTMLInputElement;
        if (input) {
          input.focus();
        }
      }

      // Handle ESC to close chat when visible
      if (isChatVisible && e.key === "Escape") {
        e.preventDefault();
        setIsChatVisible(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isChatVisible]);

  const startChat = useCallback(
    (finalMessage: string) => {
      setInitialMessage(finalMessage);
      setIsChatVisible(true);

      try {
        posthog.capture("submit_message", {
          message: finalMessage,
        });
      } catch (e) {
        console.error(e);
      }
    },
    [setInitialMessage, setIsChatVisible]
  );

  return (
    <AnimatePresence mode="wait">
      {!isChatVisible ? (
        <div className="min-h-screen bg-black flex flex-col relative">
          {/* Grid Background */}
          <div
            className="absolute inset-0 z-0 overflow-hidden pointer-events-none"
            style={{
              backgroundImage: "url(/grid.svg)",
              backgroundSize: "25%",
              backgroundPosition: "center",
              backgroundRepeat: "repeat",
              opacity: 0.5,
              position: "fixed",
              backgroundColor: "#121212",
            }}
          ></div>
          {/* Top Navigation */}
          <nav className="flex justify-between items-center px-8 py-4 bg-black border-b border-[#333333] z-10 w-full">
            <div className="flex items-center gap-3">
              <a
                href="https://www.browserbase.com/computer-use"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:opacity-90 transition-opacity duration-200"
              >
                <Image
                  src="https://img.mytsi.org/i/lP72916.png"
                  alt="Browser"
                  className="w-8 h-8"
                  width={32}
                  height={32}
                />
                <span className="font-ppsupply text-gray-400 font-semibold">
                  Browser
                </span>
              </a>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/browserbase/cua-browser"
                target="_blank"
                rel="noopener noreferrer"
              >
                <button className="h-fit flex items-center justify-center px-3 py-2 bg-[#1b2128] hover:bg-[#1d232b] gap-1 text-sm font-medium text-white border border-[#9333ea] transition-colors duration-200 rounded-lg">
                  <Image
                    src="/github.svg"
                    alt="GitHub"
                    width={20}
                    height={20}
                    className="sm:mr-2"
                  />
                  <span className="hidden sm:inline">View GitHub</span>
                </button>
              </a>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 flex flex-col items-center pt-12 md:pt-16 lg:pt-20 pb-16 md:pb-24 lg:pb-32 px-6 z-10 bg-black w-full">
            <div className="w-full bg-[#121212] border border-[#333333] shadow-lg z-10 rounded-xl overflow-hidden">
              <div className="w-full h-12 md:h-16 bg-[#1a1a1a] border-b border-[#333333] flex items-center px-4 md:px-6">
                <div className="flex items-center gap-2">
                  <Tooltip text="why would you want to close this?">
                    <div className="w-3 h-3 bg-[#ff00bf] hover:scale-110 transition-transform rounded-full" />
                  </Tooltip>
                  <Tooltip text="s/o to the 🅱️rowserbase devs">
                    <div className="w-3 h-3 bg-[#9333ea] hover:scale-110 transition-transform rounded-full" />
                  </Tooltip>
                  <Tooltip text="@pk_iv, @alexdphan, @nosajio were here">
                    <div className="w-3 h-3 bg-[#d946ef] hover:scale-110 transition-transform rounded-full" />
                  </Tooltip>
                </div>
              </div>

              <div className="p-8 md:p-10 lg:p-12 flex flex-col items-center gap-8 md:gap-10">
                <div className="flex flex-col items-center gap-3 md:gap-5">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-ppneue text-white text-center">
                    Computer Use Browser
                  </h1>
                  <p className="text-base md:text-lg font-ppsupply text-gray-400 text-center">
                    Hit run to watch AI browse the web.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const input = e.currentTarget.querySelector(
                      'input[name="message"]'
                    ) as HTMLInputElement;
                    const message = (formData.get("message") as string).trim();
                    const finalMessage = message || input.placeholder;
                    startChat(finalMessage);
                  }}
                  className="w-full max-w-[720px] md:max-w-[880px] lg:max-w-[1040px] flex flex-col items-center gap-3 md:gap-5"
                >
                  <div className="relative w-full">
                    <input
                      ref={inputRef}
                      name="message"
                      type="text"
                      placeholder="What's the price of NVIDIA stock?"
                      className="w-full px-4 py-3 sm:pr-[140px] pr-[100px] border border-[#333333] text-white bg-[#1a1a1a] placeholder:text-gray-500 focus:outline-none focus:ring-0 focus:border-[#ff00bf] font-ppsupply text-sm md:text-base md:py-5 lg:py-6 transition-all duration-300 focus:pulse-glow-pink focus:backdrop-blur-sm focus:bg-opacity-95 focus:bg-[#1a1a1a] rounded-lg"
                      style={{
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        backdropFilter: "blur(8px)",
                      }}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <AnimatedButton type="submit">Run</AnimatedButton>
                    </div>
                  </div>
                </form>
                <div className="grid grid-cols-2 gap-3 md:gap-4 lg:gap-5 w-full">
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    onClick={() =>
                      startChat(
                        "Find the most recently opened non-draft PR on Github for Browserbase's Stagehand project and make sure the combination-evals in the PR validation passed."
                      )
                    }
                    className="p-3 md:p-5 lg:p-6 text-sm md:text-base lg:text-xl text-white border border-[#333333] hover:border-[#ff00bf] hover:text-[#ff00bf] transition-colors font-ppsupply font-medium text-center overflow-hidden text-ellipsis break-words whitespace-normal md:min-h-[100px] lg:min-h-[120px] flex items-center justify-center backdrop-blur-sm bg-opacity-60 bg-[rgba(26,26,26,0.8)] hover:bg-[rgba(255,0,191,0.1)] rounded-xl"
                  >
                    <div className="w-full h-full flex flex-row justify-between items-start px-3 py-2 md:px-4 md:py-3 space-y-3">
                      <span className="text-left">Review a pull request<br />on Github</span>
                      <Code className="" size={20} strokeWidth={1.5} />
                    </div>
                  
                  </motion.button>
                  
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    onClick={() =>
                      startChat(
                        "Play a game of 2048 on https://www.2048.org/. Just try to win and I'll watch. Good luck!"
                      )
                    }
                    className="p-3 md:p-5 lg:p-6 text-sm md:text-base lg:text-xl text-white border border-[#333333] hover:border-[#ff00bf] hover:text-[#ff00bf] transition-colors font-ppsupply font-medium text-center overflow-hidden text-ellipsis break-words whitespace-normal md:min-h-[100px] lg:min-h-[120px] flex items-center justify-center backdrop-blur-sm bg-opacity-60 bg-[rgba(26,26,26,0.8)] hover:bg-[rgba(255,0,191,0.1)] rounded-xl"
                  >
                    <div className="w-full h-full flex flex-row justify-between items-start px-3 py-2 md:px-4 md:py-3">
                      <span className="text-left">Play a challenging<br />game of 2048</span>
                      <Gamepad2 size={20} strokeWidth={1.5} className="rounded-none" />
                    </div>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.5 }}
                    onClick={() =>
                      startChat(
                        "Please visit https://docs.google.com/spreadsheets/d/16fFgY7y4B2AnZLLFx4ajbBh-cuaXE-PU2ldQx-H-CcA/edit?gid=0#gid=0 and analyze the data in the sheet."
                      )
                    }
                    className="p-3 md:p-5 lg:p-6 text-sm md:text-base lg:text-xl text-white border border-[#333333] hover:border-[#ff00bf] hover:text-[#ff00bf] transition-colors font-ppsupply font-medium text-center overflow-hidden text-ellipsis break-words whitespace-normal md:min-h-[100px] lg:min-h-[120px] flex items-center justify-center backdrop-blur-sm bg-opacity-60 bg-[rgba(26,26,26,0.8)] hover:bg-[rgba(255,0,191,0.1)] rounded-xl"
                  >
                    <div className="w-full h-full flex flex-row justify-between items-start px-3 py-2 md:px-4 md:py-3 space-y-3">
                      <span className="text-left">Analyze a<br />spreadsheet</span>
                      <Table size={20} strokeWidth={1.5} className="rounded-none" />
                    </div>
                  </motion.button>
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.7 }}
                    onClick={() => startChat("How much is NVIDIA stock?")}
                    className="p-3 md:p-5 lg:p-6 text-sm md:text-base lg:text-xl text-white border border-[#333333] hover:border-[#ff00bf] hover:text-[#ff00bf] transition-colors font-ppsupply font-medium text-center overflow-hidden text-ellipsis break-words whitespace-normal md:min-h-[100px] lg:min-h-[120px] flex items-center justify-center backdrop-blur-sm bg-opacity-60 bg-[rgba(26,26,26,0.8)] hover:bg-[rgba(255,0,191,0.1)] rounded-xl"
                  >
                    <div className="w-full h-full flex flex-row justify-between items-start px-3 py-2 md:px-4 md:py-3 space-y-3">
                      <span className="text-left">Check the price<br />of NVIDIA stock</span>
                      <TrendingUp size={20} strokeWidth={1.5} className="rounded-none" />
                    </div>
                  </motion.button>
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 1.0 }}
                  className="text-center text-xs text-gray-400"
                  onAnimationComplete={() => {
                    // Focus the input field after the last animation completes
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 100);
                  }}
                >
                  <p>Or type your own request</p>
                </motion.div>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                duration: 0.5,
                delay: 0.2,
                ease: [0.25, 0.1, 0.25, 1.0],
                staggerChildren: 0.1,
              }}
              className="bg-[#1a1a1a] p-4 md:p-6 lg:p-8 mt-8 md:mt-10 w-full max-w-[640px] md:max-w-[800px] lg:max-w-[960px] relative overflow-hidden backdrop-blur-sm bg-opacity-90 rounded-xl border border-[#333333]"
            >
              {/* Tech animation background elements */}
              <motion.div
                className="absolute inset-0 opacity-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.1 }}
                transition={{ duration: 0.5 }}
              >
                <div className="absolute top-0 right-0 sm:w-20 sm:h-20 w-16 h-16 bg-[#ff00bf] rounded-full blur-xl"></div>
                <div className="absolute bottom-0 left-0 w-16 h-16 bg-[#9333ea] rounded-full blur-xl"></div>
              </motion.div>

              <motion.p
                className="text-base md:text-lg font-ppsupply text-center text-white relative z-10 font-semibold"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                Powered by{" "}
                <motion.a
                  href="https://browserbase.com"
                  className="text-[#ff00bf] hover:underline relative"
                  whileHover={{ scale: 1.05 }}
                >
                  🅱️ Browserbase
                </motion.a>{" "}
                and OpenAI&apos;s computer-use model preview.
              </motion.p>
            </motion.div>
          </main>
        </div>
      ) : (
        <ChatFeed initialMessage={initialMessage} onClose={() => setIsChatVisible(false)} />
      )}
    </AnimatePresence>
  );
}
