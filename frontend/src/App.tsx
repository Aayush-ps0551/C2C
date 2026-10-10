import React, { useState } from 'react';
import { RoomView } from './components/room/RoomView';
import { ReportView } from './components/report/ReportView';
import { HistoryView } from './components/history/HistoryView';
import { useSessionStore } from './lib/fsm/useSessionStore';
import { TopicType, SessionSettings } from './lib/types';
import { AdminCriteriaConfig } from './components/evaluations/AdminCriteriaConfig';
import { EvaluatorForm } from './components/evaluations/EvaluatorForm';
import { EvaluationDashboard } from './components/evaluations/EvaluationDashboard';
import { PhaserMap } from './components/map/PhaserMap';

type AppScreen = 'ROOM' | 'REPORT' | 'HISTORY' | 'ADMIN_EVAL_CONFIG' | 'EVALUATOR_FORM' | 'EVALUATION_DASHBOARD' | 'MAP';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('MAP');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const { initializeSession, startDiscussion, resetStore } = useSessionStore();

  const handleStartSession = async (
    topic: string, 
    topicType: TopicType, 
    caseBrief?: string, 
    settings?: Partial<SessionSettings>
  ) => {
    const session = await initializeSession(topic, topicType, caseBrief, settings);
    setActiveSessionId(session.id);
    setCurrentScreen('ROOM');
    await startDiscussion();
  };

  const handleSessionEnded = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCurrentScreen('REPORT');
  };

  const handleRetry = () => {
    resetStore();
    setCurrentScreen('MAP');
  };

  const handleBackToLobby = () => {
    resetStore();
    setCurrentScreen('MAP');
  };

  const handleSelectReport = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCurrentScreen('REPORT');
  };

  const handleOpenAdminConfig = () => setCurrentScreen('ADMIN_EVAL_CONFIG');
  const handleOpenEvaluatorForm = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCurrentScreen('EVALUATOR_FORM');
  };
  const handleOpenEvaluationDashboard = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCurrentScreen('EVALUATION_DASHBOARD');
  };

  const handleOpenMap = () => {
    setCurrentScreen('MAP');
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans">
      {currentScreen === 'MAP' && (
        <PhaserMap 
          onInteract={(obj) => {
            console.log('Interacted with', obj);
            // Example GD Session Start logic here
            // handleStartSession('Campus Placements', 'CONTEMPORARY');
          }}
        />
      )}

      {currentScreen === 'ROOM' && (
        <RoomView 
          onSessionEnded={handleSessionEnded}
        />
      )}

      {currentScreen === 'REPORT' && activeSessionId && (
        <ReportView 
          sessionId={activeSessionId}
          onRetry={handleRetry}
          onBackToLobby={handleBackToLobby}
        />
      )}

      {currentScreen === 'HISTORY' && (
        <HistoryView 
          onBackToLobby={handleBackToLobby}
          onSelectReport={handleSelectReport}
          onEvaluateSession={handleOpenEvaluatorForm}
          onViewResults={handleOpenEvaluationDashboard}
        />
      )}

      {currentScreen === 'ADMIN_EVAL_CONFIG' && (
        <AdminCriteriaConfig onBack={handleBackToLobby} />
      )}

      {currentScreen === 'EVALUATOR_FORM' && activeSessionId && (
        <EvaluatorForm 
          sessionId={activeSessionId}
          evaluatorId="demo-evaluator-1" // In a real app, this comes from auth context
          onBack={handleBackToLobby}
        />
      )}

      {currentScreen === 'EVALUATION_DASHBOARD' && activeSessionId && (
        <EvaluationDashboard 
          sessionId={activeSessionId}
          onBack={handleBackToLobby}
        />
      )}
    </div>
  );
}
