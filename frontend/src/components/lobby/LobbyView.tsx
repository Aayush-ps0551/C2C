import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Sliders, 
  Layers, 
  Clock, 
  Info,
  BookOpen,
  ArrowRight,
  Flame,
  Award,
  ShieldAlert
} from 'lucide-react';
import { TOPIC_PRESETS, TopicPreset } from '../../lib/topics';
import { PERSONAS, selectRandomPanel } from '../../lib/personas';
import { TopicType, LanguageMode, SessionSettings, RoomIntensity } from '../../lib/types';

interface LobbyViewProps {
  onStartSession: (topic: string, topicType: TopicType, caseBrief?: string, settings?: Partial<SessionSettings>) => void;
  onViewHistory: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({ onStartSession, onViewHistory }) => {
  const [selectedCategory, setSelectedCategory] = useState<TopicType>('CONTEMPORARY');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('contemp-1');
  const [customTopic, setCustomTopic] = useState<string>('');
  const [caseBrief, setCaseBrief] = useState<string>('');
  
  const [panelSize, setPanelSize] = useState<number>(4);
  const [languageMode, setLanguageMode] = useState<LanguageMode>('EN');
  const [durationMinutes, setDurationMinutes] = useState<number>(8);
  const [patienceMs, setPatienceMs] = useState<number>(1500);
  const [nudgeSecs, setNudgeSecs] = useState<number>(90);
  const [intensity, setIntensity] = useState<RoomIntensity>('REAL_GD');
  const [openingRoundEnabled, setOpeningRoundEnabled] = useState<boolean>(true);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Mic check states: 'checking' | 'ready' | 'denied' | 'unsupported'
  const [micState, setMicState] = useState<'checking' | 'ready' | 'denied' | 'unsupported'>('checking');
  const [isTextModePreferred, setIsTextModePreferred] = useState<boolean>(false);
  const [apiHealth, setApiHealth] = useState<any>(null);

  // Filter presets for current category
  const activePresets = TOPIC_PRESETS.filter(p => p.category === selectedCategory);
  const currentPreset = TOPIC_PRESETS.find(p => p.id === selectedPresetId);

  useEffect(() => {
    // Check speech recognition & mic permissions
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setMicState('unsupported');
    } else {
      navigator.mediaDevices?.getUserMedia({ audio: true })
        .then(stream => {
          setMicState('ready');
          stream.getTracks().forEach(t => t.stop());
        })
        .catch(() => {
          setMicState('denied');
        });
    }

    // Check backend health
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setApiHealth(data))
      .catch(() => setApiHealth(null));
  }, []);

  const handlePresetSelect = (preset: TopicPreset) => {
    setSelectedPresetId(preset.id);
    if (preset.caseBrief) {
      setCaseBrief(preset.caseBrief);
    } else {
      setCaseBrief('');
    }
  };

  const handleStart = () => {
    const finalTopic = selectedCategory === 'CUSTOM' 
      ? customTopic.trim() || 'Should artificial intelligence replace traditional schooling?' 
      : currentPreset?.title || 'Is AI a threat to entry-level jobs?';

    const finalBrief = selectedCategory === 'CASE' 
      ? (caseBrief || currentPreset?.caseBrief) 
      : undefined;

    onStartSession(finalTopic, selectedCategory, finalBrief, {
      panelSize,
      durationMinutes,
      patienceMs,
      nudgeSecs,
      languageMode,
      intensity,
      openingRoundEnabled
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Top Disclosure & Status Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium">
          <ShieldAlert className="w-4 h-4 text-blue-400 animate-pulse" />
          <span>AI Disclosure: Every other participant in the arena is AI</span>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={onViewHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs transition border border-slate-700/60"
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            <span>Past GD Reports</span>
          </button>

          {apiHealth && (
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span className={`w-2 h-2 rounded-full ${apiHealth.aiProviders?.hasLiveAiKeys ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400'}`} />
              <span>{apiHealth.aiProviders?.hasLiveAiKeys ? 'OpenRouter Multi-Model Online' : 'Local Fallback Engine'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Hero Header */}
      <div className="text-center mb-10">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 text-blue-300 text-sm font-semibold mb-4"
        >
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span>Placement GD Simulation Room</span>
        </motion.div>
        
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400 tracking-tight mb-3">
          GD Arena
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-base sm:text-lg">
          Join a spoken group discussion with realistic AI participants and a moderator. 
          Face real interruptions, debate perspectives, and receive a quote-linked placement report.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Topic Selection (Span 2) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Topic Categories Tabs */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-400" />
              <span>1. Choose Discussion Topic</span>
            </h2>

            {/* Category Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-6">
              {(['CONTEMPORARY', 'ABSTRACT', 'CONTROVERSIAL', 'CASE', 'CUSTOM'] as TopicType[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold capitalize transition-all border ${
                    selectedCategory === cat
                      ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/30'
                      : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:bg-slate-800/80 hover:text-slate-200'
                  }`}
                >
                  {cat.toLowerCase()}
                </button>
              ))}
            </div>

            {/* Presets Grid */}
            {selectedCategory !== 'CUSTOM' ? (
              <div className="space-y-3">
                {activePresets.map((preset) => (
                  <motion.div
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`p-4 rounded-xl cursor-pointer transition border ${
                      selectedPresetId === preset.id
                        ? 'bg-blue-500/10 border-blue-500/60 shadow-md shadow-blue-500/10'
                        : 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-slate-100 text-sm sm:text-base">{preset.title}</h3>
                        <p className="text-xs text-slate-400 mt-1">{preset.description}</p>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border mt-0.5 shrink-0 ${
                        selectedPresetId === preset.id ? 'border-blue-400 bg-blue-500' : 'border-slate-600'
                      }`}>
                        {selectedPresetId === preset.id && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </div>

                    {/* Case Brief Display */}
                    {preset.caseBrief && selectedPresetId === preset.id && (
                      <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
                        <span className="font-bold block mb-1">Case Brief:</span>
                        {preset.caseBrief}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Custom Topic</label>
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="e.g. Is remote work destroying corporate apprenticeship?"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Optional Case Brief / Context (3 sentences)</label>
                  <textarea
                    rows={3}
                    value={caseBrief}
                    onChange={(e) => setCaseBrief(e.target.value)}
                    placeholder="Provide specific scenario background for participants to analyze..."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Panel Preview Cards */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-purple-400" />
                <span>2. AI Discussion Panel</span>
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Panel Size:</span>
                {[3, 4, 5].map((size) => (
                  <button
                    key={size}
                    onClick={() => setPanelSize(size)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition border ${
                      panelSize === size
                        ? 'bg-purple-600 text-white border-purple-400'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              A random panel of {panelSize} dynamic personalities + Moderator Ananya will participate with runtime LLM generation.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {PERSONAS.slice(0, panelSize).map((p) => (
                <div 
                  key={p.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3"
                  style={{ borderLeftColor: p.accentColor, borderLeftWidth: '3px' }}
                >
                  <span className="text-2xl">{p.avatar}</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">{p.name}</h4>
                    <span className="text-[10px] font-semibold text-purple-300 block">{p.role}</span>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{p.tagline}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Audio & Settings (Span 1) */}
        <div className="space-y-6">
          {/* Mic Check & Input Mode Widget */}
          <div className="glass-panel rounded-2xl p-6">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Mic className="w-5 h-5 text-emerald-400" />
              <span>Audio & Input Check</span>
            </h2>

            {/* Mic State Card */}
            <div className={`p-4 rounded-xl border mb-4 ${
              micState === 'ready' 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : micState === 'denied'
                ? 'bg-rose-500/10 border-rose-500/30'
                : 'bg-amber-500/10 border-amber-500/30'
            }`}>
              <div className="flex items-center gap-3">
                {micState === 'ready' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                ) : micState === 'denied' ? (
                  <MicOff className="w-6 h-6 text-rose-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
                )}
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {micState === 'ready' && 'Microphone Ready'}
                    {micState === 'denied' && 'Microphone Access Denied'}
                    {micState === 'unsupported' && 'Non-Chrome Browser Detected'}
                    {micState === 'checking' && 'Testing Audio Devices...'}
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {micState === 'ready' && 'Echo cancellation active. Headphones strongly recommended.'}
                    {micState === 'denied' && 'Click Join in Text Mode to type your turns seamlessly.'}
                    {micState === 'unsupported' && 'Web Speech works best in Chrome. Text mode will activate.'}
                  </p>
                </div>
              </div>

              {micState === 'denied' && (
                <button
                  onClick={() => setIsTextModePreferred(true)}
                  className="mt-3 w-full py-1.5 px-3 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold transition"
                >
                  Switch to Text Mode Fallback
                </button>
              )}
            </div>

            {/* Hinglish Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 mb-4">
              <div>
                <span className="text-xs font-bold text-white block">Hinglish Mode</span>
                <span className="text-[10px] text-slate-400">Natural Hindi-English code-switching</span>
              </div>
              <button
                onClick={() => setLanguageMode(prev => prev === 'EN' ? 'HINGLISH' : 'EN')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                  languageMode === 'HINGLISH'
                    ? 'bg-amber-500 text-slate-900'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {languageMode}
              </button>
            </div>

            {/* Room Intensity Selector (R0 Realism Dial) */}
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>Room Intensity</span>
                </span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  intensity === 'CAMPUS_MOCK' ? 'bg-emerald-500/20 text-emerald-300' :
                  intensity === 'REAL_GD' ? 'bg-blue-500/20 text-blue-300' :
                  'bg-rose-500/20 text-rose-300'
                }`}>
                  {intensity === 'CAMPUS_MOCK' ? 'Beginner' : intensity === 'REAL_GD' ? 'Realistic GD' : 'Brutal Placement'}
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: 'CAMPUS_MOCK', label: 'Campus Mock', desc: 'Zero interrupts, 12s floor' },
                  { id: 'REAL_GD', label: 'Real GD', desc: '≤1 int/45s, 7s floor, natural' },
                  { id: 'PLACEMENT_BRUTAL', label: 'Brutal GD', desc: '≤1 int/20s, 4s floor, pressure' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setIntensity(item.id as RoomIntensity)}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      intensity === item.id
                        ? item.id === 'CAMPUS_MOCK' 
                          ? 'bg-emerald-500/15 border-emerald-400 text-emerald-200 shadow-sm'
                          : item.id === 'REAL_GD'
                          ? 'bg-blue-600/20 border-blue-400 text-blue-200 shadow-sm'
                          : 'bg-rose-500/20 border-rose-400 text-rose-200 shadow-sm'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-[11px] font-bold block">{item.label}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5 leading-tight">{item.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Opening Round Toggle (R1 Discussion Arc) */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 mb-4">
              <div>
                <span className="text-xs font-bold text-white block">Opening Round (Stance)</span>
                <span className="text-[10px] text-slate-400">15–25s stance per speaker; 5s student timeout</span>
              </div>
              <button
                onClick={() => setOpeningRoundEnabled(!openingRoundEnabled)}
                className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                  openingRoundEnabled
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                {openingRoundEnabled ? 'ACTIVE' : 'OFF'}
              </button>
            </div>

            {/* Quick Settings */}
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Duration:</span>
                  <span className="font-bold text-white">{durationMinutes} Minutes</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[5, 8, 12].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => setDurationMinutes(mins)}
                      className={`py-1 rounded-lg text-xs font-semibold border ${
                        durationMinutes === mins
                          ? 'bg-blue-600 text-white border-blue-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced Settings Accordion */}
              <div>
                <button
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Tuning Knobs (Patience & Nudge)</span>
                  </span>
                  <span>{showAdvanced ? '▲' : '▼'}</span>
                </button>

                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 pt-3 border-t border-slate-800 mt-2"
                  >
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">Patience before AI responds:</span>
                        <span className="text-blue-300 font-bold">{patienceMs}ms</span>
                      </div>
                      <input
                        type="range"
                        min={800}
                        max={3000}
                        step={100}
                        value={patienceMs}
                        onChange={(e) => setPatienceMs(Number(e.target.value))}
                        className="w-full accent-blue-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">Silent Nudge Interval:</span>
                        <span className="text-purple-300 font-bold">{nudgeSecs}s</span>
                      </div>
                      <input
                        type="range"
                        min={45}
                        max={120}
                        step={15}
                        value={nudgeSecs}
                        onChange={(e) => setNudgeSecs(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Launch Button */}
            <motion.button
              onClick={handleStart}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="mt-6 w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-base shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition"
            >
              <span>Start Group Discussion</span>
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </div>
      </div>
    </div>
  );
};
