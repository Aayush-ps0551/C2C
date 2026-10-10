import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Save } from 'lucide-react';
import { apiUrl } from '../../lib/api';

interface Criterion {
  id?: string;
  name: string;
  weightage: number;
}

export const AdminCriteriaConfig: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/evaluations/criteria'))
      .then(r => r.json())
      .then(data => {
        if (data && data.length > 0) {
          setCriteria(data);
        } else {
          // Default criteria
          setCriteria([
            { name: 'Subject Knowledge and Content Quality', weightage: 25 },
            { name: 'Communication Skills', weightage: 20 },
            { name: 'Logical Thinking and Analysis', weightage: 20 },
            { name: 'Leadership and Initiative', weightage: 15 },
            { name: 'Teamwork and Listening Skills', weightage: 10 },
            { name: 'Confidence and Body Language', weightage: 10 },
          ]);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const totalWeight = criteria.reduce((sum, c) => sum + (c.weightage || 0), 0);

  const handleUpdate = (index: number, field: keyof Criterion, value: string | number) => {
    const newCriteria = [...criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    setCriteria(newCriteria);
  };

  const handleRemove = (index: number) => {
    const newCriteria = [...criteria];
    newCriteria.splice(index, 1);
    setCriteria(newCriteria);
  };

  const handleAdd = () => {
    setCriteria([...criteria, { name: '', weightage: 0 }]);
  };

  const handleSave = async () => {
    if (totalWeight !== 100) {
      alert(`Total weight must be exactly 100%. Current is ${totalWeight}%.`);
      return;
    }

    if (criteria.some(c => !c.name.trim())) {
      alert("All criteria must have a name.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(apiUrl('/api/evaluations/criteria'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria })
      });

      if (res.ok) {
        alert('Configuration saved successfully!');
      } else {
        const err = await res.json();
        alert('Failed to save: ' + err.error);
      }
    } catch (e) {
      console.error(e);
      alert('Network error saving configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-white">Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-[#080c14] text-slate-200 p-8 overflow-y-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold font-heading text-white flex items-center gap-3">
            <Settings className="text-blue-500" /> Evaluation Configuration
          </h1>
          <p className="text-slate-400 mt-1">Configure criteria and weights for GD evaluations</p>
        </div>
        <button onClick={onBack} className="px-4 py-2 border border-slate-700 rounded-lg hover:bg-slate-800 transition">
          Back
        </button>
      </div>

      <div className="glass-panel p-8 rounded-xl max-w-4xl border border-slate-800">
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
          <h2 className="text-xl font-medium text-white">Scoring Criteria</h2>
          <div className={`px-4 py-2 rounded-lg font-bold ${totalWeight === 100 ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
            Total Weight: {totalWeight}%
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {criteria.map((c, idx) => (
            <div key={idx} className="flex gap-4 items-center bg-slate-900/50 p-4 rounded-lg border border-slate-800">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Criterion Name</label>
                <input 
                  type="text" 
                  value={c.name}
                  onChange={(e) => handleUpdate(idx, 'name', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="e.g., Communication Skills"
                />
              </div>
              <div className="w-32">
                <label className="block text-xs text-slate-500 mb-1 uppercase tracking-wider">Weight (%)</label>
                <input 
                  type="number" 
                  value={c.weightage}
                  min="0"
                  max="100"
                  onChange={(e) => handleUpdate(idx, 'weightage', parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="pt-5">
                <button 
                  onClick={() => handleRemove(idx)}
                  className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-md transition"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between border-t border-slate-800 pt-6">
          <button 
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition"
          >
            <Plus size={18} /> Add Criterion
          </button>
          
          <button 
            onClick={handleSave}
            disabled={saving || totalWeight !== 100}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition shadow-[0_0_15px_-3px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={18} /> {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
};
