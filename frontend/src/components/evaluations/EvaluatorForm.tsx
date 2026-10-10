import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2 } from 'lucide-react';
import { apiUrl } from '../../lib/api';

interface Criterion {
  id: string;
  name: string;
  weightage: number;
}

interface Participant {
  id: string;
  name: string;
}

interface ScoreInput {
  criterionId: string;
  score: number;
}

export const EvaluatorForm: React.FC<{ sessionId: string, evaluatorId: string, onBack: () => void }> = ({ sessionId, evaluatorId, onBack }) => {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({}); // participantId -> criterionId -> score
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Fetch criteria and participants
    Promise.all([
      fetch(apiUrl('/api/evaluations/criteria')).then(r => r.json()),
      // In a real app, we'd have a specific route to get participants for a session
      fetch(apiUrl(`/api/evaluations/${sessionId}/results`)).then(r => r.json())
    ])
    .then(([critData, resultsData]) => {
      setCriteria(critData);
      
      // If we don't have participants yet, mock them for demo purposes
      if (!resultsData || resultsData.length === 0 || resultsData.error) {
        setParticipants([
          { id: 'p1', name: 'Alice Smith' },
          { id: 'p2', name: 'Bob Johnson' },
          { id: 'p3', name: 'Charlie Davis' }
        ]);
      } else {
        setParticipants(resultsData.map((r: any) => ({ id: r.participantId, name: r.participantName })));
      }
    })
    .finally(() => setLoading(false));
  }, [sessionId]);

  const handleScoreChange = (participantId: string, criterionId: string, scoreStr: string) => {
    let score = parseFloat(scoreStr);
    if (isNaN(score)) score = 0;
    if (score < 0) score = 0;
    if (score > 10) score = 10;
    
    setScores(prev => ({
      ...prev,
      [participantId]: {
        ...(prev[participantId] || {}),
        [criterionId]: score
      }
    }));
  };

  const handleFeedbackChange = (participantId: string, text: string) => {
    setFeedback(prev => ({ ...prev, [participantId]: text }));
  };

  const handleSubmit = async (participantId: string) => {
    setSubmitting(true);
    
    const participantScores = criteria.map(c => ({
      criterionId: c.id,
      score: scores[participantId]?.[c.id] || 0
    }));

    try {
      const res = await fetch(apiUrl('/api/evaluations/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          participantId,
          evaluatorId,
          scores: participantScores,
          feedback: feedback[participantId] || ''
        })
      });

      if (res.ok) {
        setSubmitted(prev => ({ ...prev, [participantId]: true }));
      } else {
        const err = await res.json();
        alert('Failed to submit: ' + err.error);
      }
    } catch (error) {
      console.error(error);
      alert('Network error submitting evaluation');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full"><div className="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="flex flex-col h-full bg-[#080c14] text-slate-200 p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-heading text-white">Evaluator Dashboard</h1>
          <p className="text-slate-400 mt-1">Session ID: {sessionId} | Evaluator: {evaluatorId}</p>
        </div>
        <button onClick={onBack} className="px-4 py-2 border border-slate-700 rounded-lg hover:bg-slate-800 transition">
          Back
        </button>
      </div>

      <div className="space-y-8">
        {participants.map(p => (
          <div key={p.id} className="glass-panel p-6 rounded-xl border border-slate-800">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">{p.name}</h2>
              {submitted[p.id] && (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 size={18} />
                  <span className="text-sm font-medium">Submitted</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {criteria.map(c => (
                <div key={c.id} className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">{c.name}</label>
                    <span className="text-xs text-slate-500">{c.weightage}%</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.5"
                      value={scores[p.id]?.[c.id] ?? ''}
                      onChange={(e) => handleScoreChange(p.id, c.id, e.target.value)}
                      disabled={submitted[p.id]}
                      className="w-20 bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      placeholder="0-10"
                    />
                    <span className="text-slate-500">/ 10</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">Feedback & Comments</label>
              <textarea
                value={feedback[p.id] || ''}
                onChange={(e) => handleFeedbackChange(p.id, e.target.value)}
                disabled={submitted[p.id]}
                className="w-full bg-slate-900/50 border border-slate-800 text-white rounded-lg p-4 h-24 focus:outline-none focus:border-blue-500 disabled:opacity-50"
                placeholder="Constructive feedback for the participant..."
              />
            </div>

            {!submitted[p.id] && (
              <div className="flex justify-end">
                <button
                  onClick={() => handleSubmit(p.id)}
                  disabled={submitting}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save size={18} />
                  {submitting ? 'Saving...' : 'Submit Evaluation'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
