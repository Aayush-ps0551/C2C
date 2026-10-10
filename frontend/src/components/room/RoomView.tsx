import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import gsap from 'gsap';
import { 
  Mic, 
  MicOff, 
  Send, 
  FileText, 
  X, 
  Volume2, 
  VolumeX, 
  Clock, 
  ShieldAlert, 
  Sparkles, 
  AlertTriangle,
  Radio,
  Zap,
  CheckCircle,
  Headphones,
  Brain
} from 'lucide-react';
import { useSessionStore } from '../../lib/fsm/useSessionStore';
import { MODERATOR } from '../../lib/personas';

interface RoomViewProps {
  onSessionEnded: (sessionId: string) => void;
}

export const RoomView: React.FC<RoomViewProps> = ({ onSessionEnded }) => {
  const {
    session,
    phase,
    activePersonas,
    transcript,
    currentSpeakerId,
    currentSpeakerName,
    isAiThinking,
    thinkingPersonaId,
    liveCaption,
    isStudentInterim,
    timeRemainingSec,
    totalDurationSec,
    isMicMuted,
    isTextMode,
    activeNudgeMessage,
    intents,
    stances,
    participantStatus,
    flashingWinnerId,
    toggleMicMute,
    submitStudentTurn,
    clearNudge,
    endSession
  } = useSessionStore();

  const [typedText, setTypedText] = useState('');
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // GSAP animation for audio waveform visualizer bars
  const waveBarsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (currentSpeakerId && waveBarsRef.current) {
      const bars = waveBarsRef.current.querySelectorAll('.wave-bar');
      const tween = gsap.to(bars, {
        height: '100%',
        duration: 0.35,
        stagger: {
          each: 0.08,
          repeat: -1,
          yoyo: true
        },
        ease: 'power1.inOut'
      });
      return () => {
        tween.kill();
      };
    }
  }, [currentSpeakerId]);

  // Auto-scroll transcript drawer
  useEffect(() => {
    if (isTranscriptOpen) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, isTranscriptOpen]);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!typedText.trim()) return;
    submitStudentTurn(typedText.trim(), false);
    setTypedText('');
  };

  const handleEnd = async () => {
    const sId = await endSession();
    if (sId) {
      onSessionEnded(sId);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Combine panel: Moderator + Active Personas + Student
  const allParticipants = [
    MODERATOR,
    ...activePersonas,
    {
      id: 'student',
      name: 'You (Student)',
      avatar: '🎓',
      accentColor: '#3b82f6',
      role: 'Participant (You)',
      tagline: 'Your turn to present, debate, and lead the room.'
    }
  ];

  return (
    <div className="relative min-h-[calc(100vh-2rem)] flex flex-col justify-between max-w-7xl mx-auto px-4 py-4">
      {/* 1. TOP HEADER: Topic, Phase, Timer, AI Disclosure */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl glass-panel border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold">
            <Radio className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span>LIVE GD ARENA</span>
          </div>

          {/* Phase Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/35 text-purple-300 text-xs font-semibold">
            <span>
              {phase === 'INTRO' && 'Phase: Introduction'}
              {phase === 'OPENING_ROUND' && 'Phase: Opening Stances'}
              {phase === 'DEBATE' && 'Phase: Open Debate'}
              {phase === 'CONVERGENCE' && 'Phase: Convergence (T-90s)'}
              {phase === 'CLOSING' && 'Phase: Closing Round'}
              {phase === 'DISCUSSION' && 'Phase: Debate'}
              {phase === 'TIME_WARNING' && 'Phase: Convergence'}
              {phase === 'REPORT' && 'Phase: Evaluation'}
              {phase === 'SETUP' && 'Phase: Setup'}
            </span>
          </div>

          {/* Intensity Badge */}
          <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
            session?.settings?.intensity === 'CAMPUS_MOCK'
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
              : session?.settings?.intensity === 'PLACEMENT_BRUTAL'
              ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
              : 'bg-blue-500/15 border-blue-500/30 text-blue-300'
          }`}>
            <span>
              {session?.settings?.intensity === 'CAMPUS_MOCK' && 'Campus Mock'}
              {session?.settings?.intensity === 'PLACEMENT_BRUTAL' && 'Placement Brutal'}
              {(!session?.settings?.intensity || session?.settings?.intensity === 'REAL_GD') && 'Real GD'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-xs font-medium">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">AI Disclosure: Fellow participants are AI</span>
            <span className="md:hidden">AI Panel</span>
          </div>
        </div>

        {/* Center Timer */}
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border font-mono font-bold text-sm sm:text-base ${
            timeRemainingSec <= 90 
              ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 animate-pulse' 
              : 'bg-slate-900/80 border-slate-700 text-slate-100'
          }`}>
            <Clock className="w-4 h-4 text-slate-400" />
            <span>{formatTime(timeRemainingSec)}</span>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTranscriptOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
          >
            <FileText className="w-4 h-4 text-purple-400" />
            <span>Transcript ({transcript.length})</span>
          </button>

          <button
            onClick={handleEnd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold transition shadow-md shadow-rose-600/20"
          >
            <span>End Discussion</span>
          </button>
        </div>
      </div>

      {/* Case Brief Banner (if Case topic) */}
      {session?.caseBrief && (
        <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
          <span className="font-bold shrink-0">Case Context:</span>
          <span>{session.caseBrief}</span>
        </div>
      )}

      {/* Silent Nudge Toast */}
      <AnimatePresence>
        {activeNudgeMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={clearNudge}
            className="mt-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50 text-amber-200 text-xs font-semibold flex items-center justify-between cursor-pointer shadow-lg shadow-amber-500/10"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
              <span>{activeNudgeMessage}</span>
            </div>
            <X className="w-4 h-4 text-amber-400" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. PARTICIPANT TILES GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 my-4">
        {allParticipants.map((p) => {
          const isSpeaking = currentSpeakerId === p.id;
          const isWinnerFlash = flashingWinnerId === p.id;
          const status = participantStatus[p.id] || 'idle';
          const intent = intents[p.id];
          const stance = stances[p.id];
          const isThinking = isAiThinking && thinkingPersonaId === p.id;
          const speakTurns = transcript.filter(t => t.speakerId === p.id || (p.id === 'student' && t.speakerType === 'STUDENT')).length;

          return (
            <motion.div
              key={p.id}
              layout
              className={`relative rounded-2xl p-4 flex flex-col items-center text-center transition-all duration-300 border ${
                isWinnerFlash
                  ? 'bg-emerald-950/40 border-emerald-400 ring-4 ring-emerald-400/80 shadow-2xl shadow-emerald-500/40 scale-[1.05] animate-pulse z-10'
                  : isSpeaking
                  ? 'bg-slate-800/90 border-blue-400 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/40 scale-[1.02]'
                  : status === 'ready'
                  ? 'bg-amber-950/30 border-amber-400/70 ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/25 animate-pulse'
                  : status === 'listening'
                  ? 'bg-indigo-950/20 border-indigo-500/40 ring-2 ring-indigo-500/30 animate-pulse'
                  : isThinking
                  ? 'bg-slate-900/60 border-purple-500/50 animate-pulse'
                  : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
              }`}
              style={{
                borderTopColor: p.accentColor,
                borderTopWidth: '3px'
              }}
            >
              {/* Speaking Sound Waves */}
              {isSpeaking && (
                <div 
                  ref={waveBarsRef}
                  className="absolute top-2 right-2 flex items-end gap-0.5 h-4 w-5"
                >
                  <span className="wave-bar w-1 bg-blue-400 rounded-full h-1/3" />
                  <span className="wave-bar w-1 bg-blue-400 rounded-full h-2/3" />
                  <span className="wave-bar w-1 bg-blue-400 rounded-full h-full" />
                </div>
              )}

              {/* Avatar with Glow Ring */}
              <div className="relative mb-2">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition ${
                  isWinnerFlash
                    ? 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/50'
                    : isSpeaking 
                    ? 'bg-gradient-to-tr from-blue-600 to-purple-600 shadow-md shadow-blue-500/30' 
                    : status === 'ready'
                    ? 'bg-gradient-to-tr from-amber-600/60 to-orange-500/60 shadow-md shadow-amber-500/20'
                    : status === 'listening'
                    ? 'bg-gradient-to-tr from-indigo-900 to-slate-800 ring-1 ring-indigo-400/40'
                    : 'bg-slate-800/80'
                }`}>
                  {p.avatar}
                </div>
                {isSpeaking && (
                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </span>
                )}
                {status === 'ready' && !isSpeaking && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                )}
              </div>

              {/* Name & Role */}
              <h3 className="font-bold text-white text-xs sm:text-sm truncate w-full">{p.name}</h3>
              <span className="text-[10px] text-slate-400 truncate w-full">{p.role}</span>

              {/* Dynamic Status Badges (Section 4B Visual Polish) */}
              <div className="mt-2 flex flex-col items-center gap-1 w-full">
                {isWinnerFlash ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center gap-1 shadow-md shadow-emerald-500/40">
                    <Zap className="w-3 h-3 fill-slate-950" /> Winner!
                  </span>
                ) : isSpeaking ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 border border-blue-400/50 text-blue-300 font-bold flex items-center gap-1">
                    <Radio className="w-3 h-3 text-blue-400 animate-pulse" /> Speaking
                  </span>
                ) : status === 'ready' && intent ? (
                  <span 
                    className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/60 text-amber-300 font-semibold flex items-center gap-1 truncate max-w-full"
                    title={`Intent: ${intent.point} (Hook: "${intent.draftHook}")`}
                  >
                    <Zap className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                    <span className="truncate">Ready: {intent.move}</span>
                  </span>
                ) : status === 'listening' ? (
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-medium flex items-center gap-1">
                    <Headphones className="w-2.5 h-2.5 text-indigo-400 animate-pulse" /> Listening
                  </span>
                ) : (
                  <div className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium border border-slate-700/60">
                    {speakTurns} turns
                  </div>
                )}

                {/* Stance evolution tooltip / preview */}
                {stance && p.id !== 'student' && p.id !== 'moderator' && (
                  <span 
                    className="text-[9px] text-slate-400 italic truncate max-w-full px-1 cursor-help"
                    title={`Evolving Stance: "${stance}"`}
                  >
                    "{stance}"
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 3. CENTER STAGE: HIGH-CONTRAST LIVE CAPTIONS */}
      <div className="glass-panel rounded-2xl p-6 min-h-[140px] flex flex-col justify-center border border-slate-800 my-2">
        <div className="flex items-center gap-2 mb-2">
          {currentSpeakerName ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                <span className="text-xs font-bold text-blue-400 tracking-wide uppercase">
                  {currentSpeakerName} is speaking:
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-[10px] font-semibold">
                <Headphones className="w-3 h-3 text-indigo-400 animate-pulse" />
                <span>Room is actively listening</span>
              </div>
            </div>
          ) : isAiThinking ? (
            <div className="flex items-center gap-2 text-purple-400 text-xs font-semibold animate-pulse">
              <Sparkles className="w-4 h-4" />
              <span>Arbiter selected speaker — generating in-character speech...</span>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-slate-500 font-medium">Floor is open. Jump in or speak...</span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                <Brain className="w-3 h-3 text-purple-400" />
                <span>Intents pre-computed</span>
              </span>
            </div>
          )}
        </div>

        <p className={`text-base sm:text-xl font-medium leading-relaxed ${
          isStudentInterim ? 'text-blue-300 italic animate-pulse' : 'text-slate-100'
        }`}>
          {liveCaption || "Ready for discussion. Speak or type to participate..."}
        </p>
      </div>

      {/* 4. BOTTOM BAR: Mic & Text Mode Input Controls */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 mt-2">
        <form onSubmit={handleSendText} className="flex items-center gap-3">
          {/* Mic Toggle Button with Live Status Badge */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleMicMute}
              className={`p-3 rounded-xl transition flex items-center justify-center border ${
                isMicMuted
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/20 hover:bg-emerald-500/30'
              }`}
              title={isMicMuted ? "Click to Unmute Microphone" : "Click to Mute Microphone"}
            >
              {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 animate-pulse" />}
            </button>

            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold ${
              isMicMuted 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' 
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isMicMuted ? 'bg-rose-400' : 'bg-emerald-400 animate-ping'}`} />
              <span>{isMicMuted ? 'Mic Muted (Click to talk)' : 'Mic Live (Listening...)'}</span>
            </div>
          </div>

          {/* Text Input for Fallback / Hybrid Input */}
          <input
            type="text"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            placeholder={
              isTextMode 
                ? "Type your perspective and press Enter..." 
                : "Type here or speak naturally into your microphone..."
            }
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            disabled={!typedText.trim()}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-xs transition flex items-center gap-1.5 shrink-0 shadow-md shadow-blue-600/30"
          >
            <span>Send Turn</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 5. RIGHT TRANSCRIPT DRAWER */}
      <AnimatePresence>
        {isTranscriptOpen && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[440px] bg-slate-900/95 backdrop-blur-2xl border-l border-slate-800 z-50 flex flex-col p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-white text-base">Live Transcript</h3>
              </div>
              <button
                onClick={() => setIsTranscriptOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {transcript.map((t) => (
                <div
                  key={t.id}
                  className={`p-3 rounded-xl border text-xs ${
                    t.speakerType === 'STUDENT'
                      ? 'bg-blue-500/10 border-blue-500/30 text-blue-200'
                      : t.speakerType === 'MODERATOR'
                      ? 'bg-slate-800/60 border-slate-700 text-slate-300'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1 font-bold">
                    <span className={t.speakerType === 'STUDENT' ? 'text-blue-300' : 'text-purple-300'}>
                      {t.speakerName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal">
                      Turn #{t.idx}
                    </span>
                  </div>
                  <p className="leading-relaxed">{t.text}</p>
                  {t.wasBargeIn && (
                    <span className="inline-block mt-1 text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold">
                      Interrupted / Barged in
                    </span>
                  )}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
