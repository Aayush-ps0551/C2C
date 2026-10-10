import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { createGame } from '../../game/main';
import { AuthModal } from '../auth/AuthModal';
import { GDSettingsModal } from '../lobby/GDSettingsModal';
import { Settings, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhaserMapProps {
  onInteract?: (objectId: string) => void;
  onExit?: () => void;
}

export const PhaserMap: React.FC<PhaserMapProps> = ({ onInteract, onExit }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(true);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savedSettings, setSavedSettings] = useState<any>(null);

  useEffect(() => {
    if (gameContainerRef.current && !gameInstanceRef.current) {
      gameInstanceRef.current = createGame(gameContainerRef.current);
    }

    return () => {
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (gameInstanceRef.current && gameInstanceRef.current.input && gameInstanceRef.current.input.keyboard) {
      gameInstanceRef.current.input.keyboard.enabled = (!showAuthModal && !showSettingsModal);
    }
  }, [showAuthModal, showSettingsModal]);

  useEffect(() => {
    if (gameInstanceRef.current) {
      const scene = gameInstanceRef.current.scene.getScene('GameScene');
      if (scene) {
        scene.isUserLoggedIn = !!currentUser;
        if (currentUser && currentUser.displayName) {
          scene.updateUserName(currentUser.displayName);
        }
      }
    }
  }, [currentUser]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0b0f19]">
      <div 
        ref={gameContainerRef} 
        className="w-full h-full [&>canvas]:block [&>canvas]:image-pixelated"
      />
      <div className="absolute top-4 right-4 flex items-center gap-3 z-[100]">
        {!currentUser ? (
          <button 
            onClick={() => setShowAuthModal(true)}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-lg shadow-lg shadow-blue-500/20 border border-blue-400/30 transition-all"
          >
            Login / Sign Up
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg shadow-lg border border-slate-700 transition"
              title="GD Settings"
            >
              <Settings size={18} />
            </button>
            <div className="px-5 py-2 bg-slate-900/80 backdrop-blur-md text-slate-200 text-sm font-medium rounded-lg shadow-lg border border-slate-700/60 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              {currentUser.displayName}
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -20, x: '-50%' }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 bg-indigo-600/90 backdrop-blur-md text-white font-semibold rounded-2xl shadow-xl shadow-indigo-600/20 border border-indigo-400/50 flex items-center gap-3"
          >
            <MapPin className="w-5 h-5 text-indigo-200" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal at Spawn Point */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSuccess={(user) => {
          setCurrentUser(user);
          setShowAuthModal(false);
          // Auto-open settings if they just logged in!
          setTimeout(() => setShowSettingsModal(true), 500);
        }} 
      />

      <GDSettingsModal 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={(topic, type, brief, settings) => {
          setSavedSettings({ topic, type, brief, settings });
          setShowSettingsModal(false);
          
          // Generate a dynamic direction based on intensity
          let direction = "the North room";
          if (settings?.intensity === 'CAMPUS_MOCK') direction = "the Left (Beginner) room";
          if (settings?.intensity === 'PLACEMENT_BRUTAL') direction = "the Right (Brutal) room";
          
          setToastMessage(`Settings Saved! Head to ${direction} to start the GD.`);
          setTimeout(() => setToastMessage(null), 8000); // Hide after 8s
        }}
      />
    </div>
  );
};
