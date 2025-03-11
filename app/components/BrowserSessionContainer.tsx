import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BrowserSessionContainerProps {
  sessionUrl: string | null;
  isVisible: boolean;
  isCompleted: boolean;
  initialMessage: string | undefined;
}

const containerVariants = {
  hidden: { 
    opacity: 0,
    y: 20,
    scale: 0.98
  },
  visible: { 
    opacity: 1, 
    y: 0,
    scale: 1,
    transition: { 
      type: 'spring',
      stiffness: 300,
      damping: 30,
      mass: 1,
      delay: 0.2
    }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    scale: 0.98,
    transition: {
      duration: 0.3,
      ease: 'easeInOut'
    }
  }
};

const leftCurtainVariants = {
  hidden: { x: '-100%' },
  visible: { 
    x: '-100%',
    transition: {
      duration: 0
    }
  },
  open: {
    x: '-100%',
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 20,
      delay: 0.2
    }
  },
  close: {
    x: '0%',
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 20
    }
  }
};

const rightCurtainVariants = {
  hidden: { x: '100%' },
  visible: { 
    x: '100%',
    transition: {
      duration: 0
    }
  },
  open: {
    x: '100%',
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 20,
      delay: 0.2
    }
  },
  close: {
    x: '0%',
    transition: {
      type: 'spring',
      stiffness: 120,
      damping: 20
    }
  }
};

const BrowserSessionContainer: React.FC<BrowserSessionContainerProps> = ({
  sessionUrl,
  isVisible,
  isCompleted,
  initialMessage
}) => {
  // Track the animation state of curtains
  const [curtainState, setCurtainState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  
  // Handle curtain animation based on session state
  useEffect(() => {
    if (isVisible) {
      if (!sessionUrl && !isCompleted) {
        // Session is starting, curtains closed initially
        setCurtainState('closed');
      } else if (sessionUrl && !isCompleted) {
        // Session URL is available, open the curtains
        setCurtainState('opening');
        // After a delay, set to fully open
        const timer = setTimeout(() => setCurtainState('open'), 800);
        return () => clearTimeout(timer);
      } else if (isCompleted) {
        // Session is completed, close the curtains
        setCurtainState('closing');
      }
    }
  }, [isVisible, sessionUrl, isCompleted]);
  
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          className="w-full h-full max-w-[1000px] mx-auto flex flex-col md:justify-center"
          style={{ minHeight: "auto" }}
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          key={isCompleted ? 'completed' : 'active'}
        >
          <div className="w-full h-[250px] md:h-[600px] flex items-center justify-center overflow-hidden border border-[#CAC8C7] shadow-sm relative" 
            style={{
              backgroundColor: "rgba(245, 240, 255, 0.75)",
              backdropFilter: "blur(8px)",
            }}
          >
            {/* Left Curtain */}
            <motion.div 
              className="absolute top-0 left-0 w-1/2 h-full z-10"
              style={{ 
                backgroundColor: "#2E191E"
              }}
              variants={leftCurtainVariants}
              initial="visible"
              animate={curtainState === 'opening' || curtainState === 'open' ? "open" : "close"}
            />
            
            {/* Right Curtain */}
            <motion.div 
              className="absolute top-0 right-0 w-1/2 h-full z-10"
              style={{ 
                backgroundColor: "#2E191E"
              }}
              variants={rightCurtainVariants}
              initial="visible"
              animate={curtainState === 'opening' || curtainState === 'open' ? "open" : "close"}
            />
            {!isCompleted ? (
              sessionUrl ? (
                <iframe
                  src={sessionUrl}
                  className="w-full h-full"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                  allow="clipboard-read; clipboard-write"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  title="Browser Session"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center" style={{ backgroundColor: "rgba(245, 240, 255, 0.4)" }}>
                  <div className="animate-pulse flex flex-col items-center space-y-4 w-full">
                    <div className="h-6 bg-gray-200 rounded w-3/4 max-w-md"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2 max-w-sm"></div>
                    <div className="mt-6 flex justify-center">
                      <div className="rounded-full bg-gray-200 h-16 w-16"></div>
                    </div>
                    <div className="h-4 bg-gray-200 rounded w-1/3 max-w-xs"></div>
                  </div>
                </div>
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center" style={{ backgroundColor: "rgba(245, 240, 255, 0.4)" }}>
                <div className="flex flex-col items-center space-y-4 w-full">
                  <span className="text-lg font-bold text-white">The agent has completed the task</span>
                  <span className="text-base italic text-white">&quot;{initialMessage}&quot;</span>
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
