import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Clock, Calendar, ChevronRight, Award } from 'lucide-react';
import { Session } from '../../lib/types';
import { apiUrl } from '../../lib/api';

interface HistoryViewProps {
  onBackToLobby: () => void;
  onSelectReport: (sessionId: string) => void;
  onEvaluateSession: (sessionId: string) => void;
  onViewResults: (sessionId: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ onBackToLobby, onSelectReport, onEvaluateSession, onViewResults }) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('/api/sessions'))
      .then(res => res.json())
      .then(data => {
        setSessions(data.sessions || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Lobby</span>
        </button>

        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-purple-400" />
          <span>Past GD Sessions & Analytics</span>
        </h2>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Loading discussion history...
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border border-slate-800">
          <p className="text-slate-400 text-sm mb-4">No past discussions found yet. Complete a GD session to see your performance history.</p>
          <button
            onClick={onBackToLobby}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs"
          >
            Start Your First GD
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => onSelectReport(s.id)}
              className="p-5 rounded-2xl glass-panel border border-slate-800/80 hover:border-slate-700 cursor-pointer transition flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                    {s.topicType}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="font-semibold text-white text-sm sm:text-base">{s.topic}</h3>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{Math.round(s.durationSec / 60)} mins</span>
                  </span>
                  <span>Panel: {s.panelSize} AI Participants</span>
                  <span className={s.status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}>
                    {s.status}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); onSelectReport(s.id); }}
                  className="px-3 py-1.5 rounded-lg bg-purple-600/20 text-purple-400 text-xs font-semibold hover:bg-purple-600/40 transition border border-purple-500/30"
                >
                  AI Report
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onEvaluateSession(s.id); }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 text-xs font-semibold hover:bg-blue-600/40 transition border border-blue-500/30"
                >
                  Evaluate
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onViewResults(s.id); }}
                  className="px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 text-xs font-semibold hover:bg-green-600/40 transition border border-green-500/30"
                >
                  Final Results
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
