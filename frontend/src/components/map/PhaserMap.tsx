import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import { createGame } from '../../game/main';
import { AuthModal } from '../auth/AuthModal';
import { GDSettingsModal } from '../lobby/GDSettingsModal';
import { BottomToolbar } from './BottomToolbar';
import { useSessionStore } from '../../lib/fsm/useSessionStore';
import { Settings, MapPin, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, buildUserProfile } from '../../lib/supabase';

interface PhaserMapProps {
  onInteract?: (objectId: string) => void;
  onExit?: () => void;
}

export const PhaserMap: React.FC<PhaserMapProps> = ({ onInteract, onExit }) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(() => {
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('code=') || window.location.hash.includes('access_token=')) {
        return false;
      }
      const hasSbSession = Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (hasSbSession) {
        return false;
      }
    }
    return true;
  });
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savedSettings, setSavedSettings] = useState<any>(null);
  const [currentRoom, setCurrentRoom] = useState<string>('lobby');
  const [isGdActive, setIsGdActive] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const initializeSession = useSessionStore(s => s.initializeSession);
  const startDiscussion = useSessionStore(s => s.startDiscussion);
  const endSession = useSessionStore(s => s.endSession);
  const currentSpeakerId = useSessionStore(s => s.currentSpeakerId);
  const participantStatus = useSessionStore(s => s.participantStatus);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGdActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsGdActive(false);
            endSession();
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGdActive, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const handleRoomChanged = (e: any) => {
      setCurrentRoom(e.detail.room);
    };
    window.addEventListener('room-changed', handleRoomChanged);
    return () => window.removeEventListener('room-changed', handleRoomChanged);
  }, []);

  const getTargetRoomId = () => {
    if (!savedSettings) return null;
    if (savedSettings.settings?.panelSize === 3) return 'small_gd';
    if (savedSettings.settings?.panelSize === 5) return 'medium_gd';
    if (savedSettings.settings?.panelSize === 7) return 'large_gd';
    return null;
  };

  useEffect(() => {
    let isMounted = true;

    // Clean up OAuth query parameters from URL once redirected back
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('code=') || window.location.hash.includes('access_token=')) {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState(null, '', cleanUrl);
      }
    }

    // 1. Restore active session if present
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!isMounted) return;
      if (session?.user) {
        const profile = await buildUserProfile(session.user);
        if (!isMounted) return;
        setCurrentUser(profile);
        setShowAuthModal(false);
      } else {
        setShowAuthModal(true);
      }
    }).catch(err => {
      console.warn('[Session Restore Warning]', err);
    });

    // 2. Listen for auth changes (OAuth redirect completion, login, logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
        const profile = await buildUserProfile(session.user);
        if (!isMounted) return;
        setCurrentUser(profile);
        setShowAuthModal(false);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setShowAuthModal(true);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('Sign out error', err);
    }
    setCurrentUser(null);
    setShowAuthModal(true);
  };

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
    if (gameInstanceRef.current && gameInstanceRef.current.scene) {
      try {
        const scene = gameInstanceRef.current.scene.getScene('GameScene');
        if (scene) {
          scene.isUserLoggedIn = !!currentUser;
          if (typeof scene.updateUserName === 'function') {
            scene.updateUserName(currentUser?.displayName || '');
          }
        }
        // Map backend speaker ID to frontend game ID
        if (scene.aiCharacters) {
          const roomId = getTargetRoomId();
          let prefix = '';
          if (roomId === 'small_gd') prefix = 'small_';
          if (roomId === 'medium_gd') prefix = 'med_';
          if (roomId === 'large_gd') prefix = 'large_';
          
          scene.aiCharacters.forEach((char: any) => {
            const rawId = char.id.replace(prefix, '');
            let statusToSet = participantStatus[rawId] || 'idle';
            
            if (currentSpeakerId && currentSpeakerId !== 'student' && rawId === currentSpeakerId) {
              statusToSet = 'speaking';
            }
            
            if (char.setStatus) {
              char.setStatus(statusToSet);
            } else if (char.setSpeaking) {
              char.setSpeaking(statusToSet === 'speaking');
            }
          });
        }
      } catch (err) {
        console.warn('[Phaser Scene Sync]', err);
      }
    }
  }, [currentUser, currentSpeakerId, participantStatus, savedSettings]);

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
            <button
              onClick={handleLogout}
              className="p-2.5 bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-300 rounded-lg shadow-lg border border-slate-700 transition"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
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

      {/* Optional Toolbar floating at bottom */}
      {currentUser && <BottomToolbar />}

      {/* GD Start/End Button */}
      {currentRoom !== 'lobby' && currentRoom === getTargetRoomId() && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[150] flex flex-col items-center gap-2">
          {isGdActive && timeLeft > 0 && (
            <div className="px-5 py-2 bg-slate-900/90 text-white font-mono text-2xl font-bold rounded-xl border border-slate-700/50 backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
              {formatTime(timeLeft)}
            </div>
          )}
          <div className="px-4 py-1.5 bg-slate-900/90 text-slate-300 text-sm font-medium rounded-full border border-slate-700/50 backdrop-blur-sm">
            {savedSettings?.topic}
          </div>
          {!isGdActive ? (
            <button 
              onClick={() => {
                setIsGdActive(true);
                if (savedSettings?.settings?.durationMinutes) {
                  setTimeLeft(savedSettings.settings.durationMinutes * 60);
                }
                startDiscussion();
              }}
              className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(52,211,153,0.3)] border border-emerald-400/50 transition-all transform hover:scale-105"
            >
              Start GD
            </button>
          ) : (
            <button 
              onClick={() => {
                setIsGdActive(false);
                setTimeLeft(0);
                endSession();
              }}
              className="px-8 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(244,63,94,0.3)] border border-red-400/50 transition-all transform hover:scale-105"
            >
              End GD
            </button>
          )}
        </div>
      )}

      {/* Auth Modal at Spawn Point */}
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
        onSuccess={(user) => {
          setCurrentUser(user);
          setShowAuthModal(false);
        }} 
      />

      <GDSettingsModal 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={async (topic, type, brief, settings) => {
          setSavedSettings({ topic, type, brief, settings });
          await initializeSession(topic, type, brief, settings);
          setShowSettingsModal(false);
          
          // Generate a dynamic direction based on panel size
          let direction = "the North room";
          if (settings?.panelSize === 3) direction = "the Left (Small Panel) room";
          if (settings?.panelSize === 7) direction = "the Right (Large Panel) room";
          if (settings?.panelSize === 5) direction = "the North (Standard Panel) room";
          
          setToastMessage(`Settings Saved! Head to ${direction} to start the GD.`);
          setTimeout(() => setToastMessage(null), 8000); // Hide after 8s
        }}
      />
    </div>
  );
};
