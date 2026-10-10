import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import confetti from 'canvas-confetti';
import { 
  Award, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  ArrowLeft, 
  RotateCcw, 
  Download, 
  Clock, 
  BarChart2, 
  Lightbulb, 
  MessageSquare,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { ReportData, Turn } from '../../lib/types';

interface ReportViewProps {
  sessionId: string;
  onRetry: () => void;
  onBackToLobby: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({ sessionId, onRetry, onBackToLobby }) => {
  const [report, setReport] = useState<ReportData | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuoteIdx, setSelectedQuoteIdx] = useState<number | null>(null);

  const scoreRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch report data
    setIsLoading(true);
    fetch(`/api/report/${sessionId}`)
      .then(res => {
        if (!res.ok) {
          // If not created yet, request generation
          return fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId, durationSec: 480 })
          }).then(r => r.json());
        }
        return res.json();
      })
      .then(data => {
        setReport(data);
        setIsLoading(false);

        // Confetti celebration if score is high
        if (data.overallScore >= 75) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      })
      .catch(err => {
        console.warn('[Report Load Error]', err);
        setIsLoading(false);
      });

    // Fetch session turns for transcript jump-links
    fetch(`/api/sessions/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.turns) setTurns(data.turns);
      })
      .catch(() => {});
  }, [sessionId]);

  // GSAP animation for metrics chart bars
  useEffect(() => {
    if (report && chartRef.current) {
      const bars = chartRef.current.querySelectorAll('.metric-bar-fill');
      gsap.fromTo(bars, 
        { width: '0%' },
        { width: (i, el) => el.getAttribute('data-width') || '10%', duration: 1.2, ease: 'power2.out', stagger: 0.1 }
      );
    }
  }, [report]);

  const handleDownloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gd-arena-report-${sessionId}.json`;
    a.click();
  };

  const jumpToTranscript = (turnIdx: number) => {
    setSelectedQuoteIdx(turnIdx);
    const el = document.getElementById(`transcript-turn-${turnIdx}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      gsap.fromTo(el, { backgroundColor: 'rgba(59, 130, 246, 0.4)' }, { backgroundColor: 'rgba(15, 23, 42, 0.6)', duration: 2 });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <Sparkles className="w-10 h-10 text-purple-400 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Analyzing Placement Discussion...</h2>
        <p className="text-sm text-slate-400 max-w-md">
          Synthesizing turn analytics, quote references, and campus recruitment evaluation metrics.
        </p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <AlertCircle className="w-10 h-10 text-amber-400 mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Report Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">Insufficient turns were recorded to generate a full evaluation.</p>
        <button
          onClick={onBackToLobby}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  // Calculate highest speaking time for relative scaling
  const maxSpeakTime = Math.max(...Object.values(report.metrics.speakTimeBySpeaker || { 'Default': 60 }), 1);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Lobby</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-400" />
            <span>Retry This Topic</span>
          </button>

          <button
            onClick={handleDownloadReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition shadow-md shadow-blue-600/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Report</span>
          </button>
        </div>
      </div>

      {/* 1. OVERALL SCORE HEADER */}
      <div className="glass-panel rounded-3xl p-8 border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-blue-600/10 via-purple-600/10 to-transparent pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          {/* Score Badge */}
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
              Campus Placement Score
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
                {report.overallScore}
              </span>
              <span className="text-2xl font-bold text-slate-500">/ 100</span>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              {report.overallScore >= 80 ? '🌟 Outstanding: Ready for Tier-1 Consulting & Product GDs' :
               report.overallScore >= 65 ? '👍 Solid: Clear structure with minor tactical polish needed' :
               '📈 Developing: Focus on evidence frameworks and early entry'}
            </p>
          </div>

          {/* Strengths & Focus Areas */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
                <CheckCircle className="w-4 h-4" />
                <span>Top Strengths</span>
              </h3>
              <ul className="text-xs text-slate-300 space-y-1.5">
                {report.summary.strengths.map((str, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-emerald-400 font-bold">•</span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <h3 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span>Focus Areas for Round 2</span>
              </h3>
              <ul className="text-xs text-slate-300 space-y-1.5">
                {report.summary.focusAreas.map((foc, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{foc}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 2. SPEAKING-TIME & TURN METRICS CHART */}
      <div ref={chartRef} className="glass-panel rounded-2xl p-6 border border-slate-800">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <BarChart2 className="w-5 h-5 text-purple-400" />
          <span>Speaking Distribution & Airtime Variation</span>
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Notice the speaking volume contrast: Dominator participants assert substantial airtime, while the Quiet Thinker delivers sharp, high-leverage interventions.
        </p>

        <div className="space-y-4">
          {Object.entries(report.metrics.speakTimeBySpeaker || {}).map(([name, timeSec]) => {
            const percent = Math.min(100, Math.round((timeSec / maxSpeakTime) * 100));
            const isStudent = name.toLowerCase().includes('student') || name.toLowerCase().includes('you');

            return (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={`font-semibold ${isStudent ? 'text-blue-300' : 'text-slate-300'}`}>
                    {name} {isStudent && '(You)'}
                  </span>
                  <span className="text-slate-400 font-mono">
                    {timeSec}s ({report.metrics.turnCounts?.[name] || 1} turns)
                  </span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800/80 overflow-hidden">
                  <div
                    className={`metric-bar-fill h-full rounded-full transition-all ${
                      isStudent 
                        ? 'bg-gradient-to-r from-blue-500 to-indigo-500 shadow-md shadow-blue-500/30' 
                        : name.includes('Aarav') 
                        ? 'bg-rose-500' 
                        : name.includes('Rohan') 
                        ? 'bg-purple-500' 
                        : 'bg-slate-600'
                    }`}
                    data-width={`${percent}%`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Tactical Key Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800">
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">First to Speak</span>
            <span className="text-sm font-bold text-white mt-1 block">{report.metrics.firstToSpeak}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Interruptions Made</span>
            <span className="text-sm font-bold text-emerald-400 mt-1 block">{report.metrics.interruptionsMade}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Interruptions Faced</span>
            <span className="text-sm font-bold text-rose-400 mt-1 block">{report.metrics.interruptionsFaced}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">Filler Words</span>
            <span className="text-sm font-bold text-amber-400 mt-1 block">{report.metrics.fillerWordCount}</span>
          </div>
        </div>
      </div>

      {/* 3. GROUPED QUOTE-LINKED FEEDBACK CARDS */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <span>Quote-Linked Evaluator Feedback</span>
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          Every evaluation point directly references an exact spoken quote from the transcript with actionable placement coaching.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.feedback.map((item, idx) => (
            <div
              key={idx}
              className={`p-5 rounded-2xl border flex flex-col justify-between ${
                item.kind === 'STRENGTH'
                  ? 'bg-emerald-500/5 border-emerald-500/20'
                  : 'bg-amber-500/5 border-amber-500/20'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    item.kind === 'STRENGTH'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {item.category.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {item.timestamp || 'In Discussion'}
                  </span>
                </div>

                {/* Exact Quote Box */}
                <blockquote className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs italic text-slate-300 mb-3 border-l-2 border-l-blue-400">
                  "{item.quote}"
                  <span className="block text-[10px] text-slate-500 not-italic font-semibold mt-1">
                    — Spoken by {item.speakerName}
                  </span>
                </blockquote>

                <p className="text-xs text-slate-200 font-medium leading-relaxed mb-2">
                  {item.comment}
                </p>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <p className="text-[11px] text-purple-300 font-medium">
                  💡 <span className="font-semibold">Tip:</span> {item.suggestion}
                </p>
                {item.quoteTurnIdx && (
                  <button
                    onClick={() => jumpToTranscript(item.quoteTurnIdx)}
                    className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-0.5 shrink-0 ml-2"
                  >
                    <span>View in Transcript</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. "WHAT YOU COULD HAVE SAID" (MISSED OPENINGS) */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-400" />
          <span>What You Could Have Said: Seizing Missed Openings</span>
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          High-scoring GD candidates don't just speak—they identify hesitations and steer the room. Here are high-leverage lines you could have used:
        </p>

        <div className="space-y-4">
          {report.missedOpenings.map((open, i) => (
            <div key={i} className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-200">
                  Opportunity at Turn #{open.turnIdx}
                </span>
                <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10">
                  Strategic Opening
                </span>
              </div>
              
              <p className="text-xs text-slate-400 mb-2">
                <strong className="text-slate-300">Context:</strong> {open.context}
              </p>
              <p className="text-xs text-slate-400 mb-3">
                <strong className="text-slate-300">Why it was an opening:</strong> {open.whyItWasAnOpening}
              </p>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs text-purple-200">
                <span className="font-bold block text-purple-300 mb-1">Recommended Spoken Line:</span>
                "{open.suggestedLine}"
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. FULL TRANSCRIPT WITH JUMP-TARGETS */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <h2 className="text-base font-bold text-white mb-4">Complete Discussion Transcript</h2>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
          {turns.map((t) => (
            <div
              key={t.id}
              id={`transcript-turn-${t.idx}`}
              className={`p-3.5 rounded-xl border text-xs transition-all ${
                t.speakerType === 'STUDENT'
                  ? 'bg-blue-500/10 border-blue-500/30 text-blue-100'
                  : 'bg-slate-900/60 border-slate-800 text-slate-300'
              }`}
            >
              <div className="flex justify-between font-bold mb-1">
                <span className={t.speakerType === 'STUDENT' ? 'text-blue-300' : 'text-purple-300'}>
                  {t.speakerName}
                </span>
                <span className="text-[10px] text-slate-500">Turn #{t.idx}</span>
              </div>
              <p className="leading-relaxed">{t.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
