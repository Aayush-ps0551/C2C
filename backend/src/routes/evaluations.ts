import { Router } from 'express';
import { getSupabase } from '../db/supabase';
import { calculateRankings, EvaluationCriterion, Participant } from '../lib/evaluationsEngine';

const router = Router();

// Get Criteria
router.get('/criteria', async (_req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not connected' });

  const { data, error } = await supabase.from('gd_criteria').select('*').order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Update Criteria (Admin)
router.post('/criteria', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not connected' });
  
  const { criteria } = req.body; // Array of { id, name, weightage }
  
  // Validate total weight
  const totalWeight = criteria.reduce((sum: number, c: any) => sum + (c.weightage || 0), 0);
  if (totalWeight !== 100) return res.status(400).json({ error: 'Total weightage must be exactly 100' });

  for (const c of criteria) {
    if (c.id) {
      await supabase.from('gd_criteria').update({ weightage: c.weightage, name: c.name }).eq('id', c.id);
    } else {
      await supabase.from('gd_criteria').insert({ name: c.name, weightage: c.weightage });
    }
  }

  res.json({ success: true });
});

// Submit Evaluation
router.post('/submit', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not connected' });

  const { sessionId, participantId, evaluatorId, scores, feedback } = req.body;
  
  // Basic validation
  if (!sessionId || !participantId || !evaluatorId || !scores) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Create or update evaluation
    const { data: evalData, error: evalErr } = await supabase
      .from('gd_evaluations')
      .upsert(
        { session_id: sessionId, participant_id: participantId, evaluator_id: evaluatorId, status: 'SUBMITTED', feedback },
        { onConflict: 'participant_id,evaluator_id' }
      )
      .select()
      .single();

    if (evalErr) throw evalErr;

    // 2. Insert scores
    const scoreInserts = scores.map((s: any) => ({
      evaluation_id: evalData.id,
      criterion_id: s.criterionId,
      score: s.score
    }));

    // Delete old scores first if any
    await supabase.from('gd_scores').delete().eq('evaluation_id', evalData.id);
    
    const { error: scoreErr } = await supabase.from('gd_scores').insert(scoreInserts);
    if (scoreErr) throw scoreErr;

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Get Session Results
router.get('/:sessionId/results', async (req, res) => {
  const supabase = getSupabase();
  if (!supabase) return res.status(500).json({ error: 'Database not connected' });

  const { sessionId } = req.params;

  try {
    // Fetch Criteria
    const { data: criteriaData } = await supabase.from('gd_criteria').select('*');
    if (!criteriaData || criteriaData.length === 0) return res.status(400).json({ error: 'Criteria not configured' });

    // Fetch Participants
    const { data: participantsData } = await supabase.from('gd_participants').select('*').eq('session_id', sessionId);
    if (!participantsData) return res.json([]);

    // Fetch Evaluations & Scores
    const { data: evaluationsData } = await supabase.from('gd_evaluations').select('*, gd_scores(*)').eq('session_id', sessionId);

    // Map to engine format
    const criteria: EvaluationCriterion[] = criteriaData.map(c => ({ id: c.id, name: c.name, weightage: c.weightage }));
    
    const participants: Participant[] = participantsData.map(p => {
      const pEvals = (evaluationsData || []).filter(e => e.participant_id === p.id);
      
      const mappedEvals = pEvals.map(e => ({
        evaluatorId: e.evaluator_id,
        scores: e.gd_scores.map((s: any) => ({ criterionId: s.criterion_id, score: Number(s.score) }))
      }));

      return {
        id: p.id,
        name: p.name,
        evaluations: mappedEvals
      };
    });

    const results = calculateRankings(participants, criteria);
    res.json(results);

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
