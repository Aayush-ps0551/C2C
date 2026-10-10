import React, { useEffect, useState } from 'react';
import { Download, Users, BarChart } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { apiUrl } from '../../lib/api';

interface Criterion {
  id: string;
  name: string;
  weightage: number;
}

interface FinalResult {
  participantId: string;
  participantName: string;
  finalScore: number;
  percentage: number;
  rank: number;
  performanceLevel: 'Excellent' | 'Good' | 'Average' | 'Needs Improvement';
  criterionAverages: Record<string, number>;
}

export const EvaluationDashboard: React.FC<{ sessionId: string, onBack: () => void }> = ({ sessionId, onBack }) => {
  const [results, setResults] = useState<FinalResult[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real implementation this would fetch from /api/evaluations/:sessionId/results
    // We mock it for the initial skeleton load until the backend is fully wired in
    fetch(apiUrl('/api/evaluations/criteria'))
      .then(r => r.json())
      .then(c => {
        setCriteria(c);
        return fetch(apiUrl(`/api/evaluations/${sessionId}/results`));
      })
      .then(r => r.json())
      .then(data => {
        setResults(data || []);
      })
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(`GD Results - Session ${sessionId.slice(0,8)}`, 14, 22);
    
    const tableData = results.map(r => [
      `#${r.rank}`,
      r.participantName,
      r.finalScore.toString(),
      r.performanceLevel,
      criteria.map(c => `${c.name}: ${(r.criterionAverages[c.id] || 0).toFixed(1)}`).join('\n')
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Rank', 'Participant', 'Final Score', 'Performance', 'Detailed Breakdown']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [37, 99, 235] }
    });

    doc.save(`GD_Results_${sessionId.slice(0,8)}.pdf`);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Excellent': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'Good': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'Average': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      default: return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#080c14] text-slate-200 p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-heading text-white">GD Results Dashboard</h1>
          <p className="text-slate-400 mt-1">Session ID: {sessionId}</p>
        </div>
        <div className="flex gap-4">
          <button onClick={onBack} className="px-4 py-2 border border-slate-700 rounded-lg hover:bg-slate-800 transition">
            Back
          </button>
          <button onClick={exportPDF} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)]">
            <Download size={18} /> Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-8 h-8 border-t-2 border-blue-500 border-solid rounded-full animate-spin"></div>
        </div>
      ) : results.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-xl flex flex-col items-center">
          <BarChart size={48} className="text-slate-600 mb-4" />
          <h2 className="text-xl font-medium text-slate-300">No Evaluations Yet</h2>
          <p className="text-slate-500 mt-2 max-w-md">Evaluators have not submitted their scores for this session, or the required number of evaluations hasn't been met.</p>
        </div>
      ) : (
        <div className="glass-panel rounded-xl overflow-hidden border border-slate-800">
          <table className="w-full text-left">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-medium">
              <tr>
                <th className="p-4">Rank</th>
                <th className="p-4">Participant</th>
                <th className="p-4 text-center">Final Score</th>
                <th className="p-4">Performance</th>
                <th className="p-4">Detailed Breakdown</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {results.map((r) => (
                <tr key={r.participantId} className="hover:bg-slate-800/30 transition">
                  <td className="p-4 font-bold text-xl text-slate-300">#{r.rank}</td>
                  <td className="p-4">
                    <div className="font-medium text-white">{r.participantName}</div>
                    <div className="text-xs text-slate-500">{r.participantId.slice(0,8)}...</div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border-2 border-blue-500/30 bg-blue-500/10 text-blue-400 font-bold">
                      {r.finalScore}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getLevelColor(r.performanceLevel)}`}>
                      {r.performanceLevel}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {criteria.map(c => (
                        <div key={c.id} className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-300 flex justify-between gap-4 w-48">
                          <span className="truncate">{c.name}</span>
                          <span className="font-mono text-blue-400">{(r.criterionAverages[c.id] || 0).toFixed(1)}/10</span>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
