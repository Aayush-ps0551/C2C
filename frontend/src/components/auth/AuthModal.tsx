import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Sparkles, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password || (!isLogin && !displayName)) {
        throw new Error('Please fill in all fields');
      }

      let userObj = null;

      if (isLogin) {
        // Sign in
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) throw signInError;
        
        // Fetch display name from public.users
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('display_name')
          .eq('email', email)
          .single();
          
        userObj = {
          id: data.user.id,
          email: data.user.email,
          displayName: userData?.display_name || email.split('@')[0],
        };
      } else {
        // Sign up
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password
        });
        if (signUpError) throw signUpError;
        
        if (!data.user) throw new Error('Failed to create account');

        // Note: For prototypes where email confirmation is off, data.user is available immediately.
        // We will manually insert them into public.users table as requested by schema
        const { error: insertError } = await supabase
          .from('users')
          .insert([
            { 
              id: data.user.id, 
              email, 
              password_hash: 'managed_by_supabase_auth', 
              display_name: displayName 
            }
          ]);
          
        if (insertError) {
          console.warn("Failed to insert into public.users:", insertError);
          // We won't block login if it fails, but ideally it shouldn't.
        }

        userObj = {
          id: data.user.id,
          email: data.user.email,
          displayName,
        };
      }

      onSuccess(userObj);
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onKeyDown={(e) => e.stopPropagation()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md p-8 retro-panel overflow-hidden font-['VT323'] text-xl"
          >
          {/* Subtle background glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none translate-y-1/3 -translate-x-1/3" />

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition z-10"
          >
            <X size={20} />
          </button>

          <div className="text-center mb-8 relative z-10">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/20 border-2 border-blue-500 mb-4">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <h2 className="text-4xl font-bold text-white mb-1">
              {isLogin ? 'Player Login' : 'New Player'}
            </h2>
            <p className="text-xl text-slate-400">
              {isLogin ? 'Enter your credentials.' : 'Create an account to play.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {!isLogin && (
              <div>
                <label className="block text-xl text-slate-300 mb-1 uppercase tracking-wider">Display Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-900 border-2 border-slate-600 text-white text-xl focus:outline-none focus:border-blue-500 transition"
                    placeholder="E.g. Aayush"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xl text-slate-300 mb-1 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border-2 border-slate-600 text-white text-xl focus:outline-none focus:border-blue-500 transition"
                  placeholder="you@university.edu"
                />
              </div>
            </div>

            <div>
              <label className="block text-xl text-slate-300 mb-1 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border-2 border-slate-600 text-white text-xl focus:outline-none focus:border-blue-500 transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p className="text-xl text-rose-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-6 retro-btn text-2xl"
            >
              {loading ? 'Processing...' : (isLogin ? 'Press Start (Login)' : 'Insert Coin (Sign Up)')}
            </button>
          </form>

          <div className="mt-6 text-center relative z-10">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-xl text-slate-400 hover:text-white transition"
            >
              {isLogin ? "No save file? Create one here." : "Load save file? Login here."}
            </button>
          </div>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
};
