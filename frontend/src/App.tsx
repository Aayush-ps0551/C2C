import React, { useState } from 'react';
import { LobbyView } from './components/lobby/LobbyView';
import { RoomView } from './components/room/RoomView';
import { ReportView } from './components/report/ReportView';
import { HistoryView } from './components/history/HistoryView';
import { useSessionStore } from './lib/fsm/useSessionStore';
import { TopicType, SessionSettings } from './lib/types';

type AppScreen = 'LOBBY' | 'ROOM' | 'REPORT' | 'HISTORY';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('LOBBY');
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
    setCurrentScreen('LOBBY');
  };

  const handleBackToLobby = () => {
    resetStore();
    setCurrentScreen('LOBBY');
  };

  const handleSelectReport = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setCurrentScreen('REPORT');
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col font-sans">
      {currentScreen === 'LOBBY' && (
        <LobbyView 
          onStartSession={handleStartSession}
          onViewHistory={() => setCurrentScreen('HISTORY')}
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
        />
      )}
    </div>
  );
}
