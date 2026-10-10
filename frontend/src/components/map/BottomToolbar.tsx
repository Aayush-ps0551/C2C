import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { motion } from 'framer-motion';

const AudioVisualizer = ({ stream }: { stream: MediaStream | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!stream || !canvasRef.current) return;
    
    // Create AudioContext
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const audioCtx = new AudioContext();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaStreamSource(stream);
    source.connect(analyser);
    
    // Set up FFT (Fast Fourier Transform)
    analyser.fftSize = 64; 
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // We only use the first half of the frequencies as the higher ones are mostly empty/noise
      const effectiveLength = Math.floor(bufferLength * 0.7);
      const barWidth = (canvas.width / effectiveLength) - 1;
      let x = 0;
      
      for (let i = 0; i < effectiveLength; i++) {
        // Soften the height for aesthetic visual
        const value = dataArray[i];
        const percent = value / 255;
        const barHeight = (percent * canvas.height) * 0.8;
        
        ctx.fillStyle = percent > 0.7 ? '#60a5fa' : '#38bdf8'; // Blue gradient effect
        
        // Center the bars vertically
        const y = (canvas.height - barHeight) / 2;
        
        ctx.fillRect(x, y, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    
    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      source.disconnect();
      audioCtx.close().catch(console.error);
    };
  }, [stream]);

  return (
    <div className="flex items-center justify-center bg-slate-900 rounded-xl px-4 h-12 w-48 border border-slate-700/60 overflow-hidden">
      {stream ? (
        <canvas ref={canvasRef} width={180} height={40} className="w-full h-full" />
      ) : (
        <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">Mic Muted</span>
      )}
    </div>
  );
};

export const BottomToolbar = () => {
  const [micOn, setMicOn] = useState(false);
  const [videoOn, setVideoOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const toggleMic = async () => {
    if (micOn) {
      // Turn off
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      setMicOn(false);
    } else {
      // Turn on
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setStream(audioStream);
        setMicOn(true);
      } catch (err) {
        console.error("Mic access denied", err);
      }
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[150]">
      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-1.5 p-1.5 bg-black border-2 border-slate-800 rounded-[20px] shadow-2xl shadow-black/50"
      >

        
        {/* Mic Toggle */}
        <button 
          onClick={toggleMic}
          className={`flex items-center justify-center w-14 h-12 rounded-xl transition border ${
            micOn 
              ? 'bg-slate-800 border-slate-600 text-white' 
              : 'bg-slate-900 border-slate-800 text-rose-500 hover:bg-slate-800/80 hover:text-rose-400'
          }`}
          title="Toggle Microphone"
        >
          {micOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        
        {/* Video Toggle */}
        <button 
          onClick={() => setVideoOn(!videoOn)}
          className={`flex items-center justify-center w-14 h-12 rounded-xl transition border ${
            videoOn 
              ? 'bg-slate-800 border-slate-600 text-white' 
              : 'bg-slate-900 border-slate-800 text-rose-500 hover:bg-slate-800/80 hover:text-rose-400'
          }`}
          title="Toggle Camera"
        >
          {videoOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>

        {/* Audio Wave Visualizer */}
        <div className="ml-1">
          <AudioVisualizer stream={stream} />
        </div>
      </motion.div>
    </div>
  );
};
