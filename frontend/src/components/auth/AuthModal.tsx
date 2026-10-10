import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Sparkles, X } from 'lucide-react';
import { supabase, buildUserProfile } from '../../lib/supabase';

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
  const [oauthLoading, setOauthLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setError('');
    setOauthLoading(true);

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });

      if (oauthError) throw oauthError;
    } catch (err: any) {
      console.error('[Google OAuth Error]', err);
      setError(err.message || 'Failed to start Google sign-in. Please try again.');
      setOauthLoading(false);
    }
  };

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
        
        userObj = await buildUserProfile(data.user);
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
              disabled={loading || oauthLoading}
              className="w-full py-3 mt-6 retro-btn text-2xl disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : (isLogin ? 'Press Start (Login)' : 'Insert Coin (Sign Up)')}
            </button>

            {/* OR Divider */}
            <div className="relative flex py-2 items-center my-1">
              <div className="flex-grow border-t-2 border-slate-700"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-lg uppercase tracking-wider font-bold">OR</span>
              <div className="flex-grow border-t-2 border-slate-700"></div>
            </div>

            {/* Google OAuth Button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={oauthLoading || loading}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border-2 border-slate-600 hover:border-slate-400 text-white flex items-center justify-center gap-3 text-xl transition shadow-[3px_3px_0px_rgba(15,23,42,1)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {oauthLoading ? (
                <span className="text-blue-300 animate-pulse">Connecting to Google...</span>
              ) : (
                <>
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
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
