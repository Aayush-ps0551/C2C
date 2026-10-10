import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase credentials in frontend environment. Using fallback client.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}

/**
 * Resolves a unified player profile from Supabase Auth user object,
 * checking public.users table and automatically synchronizing OAuth metadata.
 */
export async function buildUserProfile(user: any): Promise<UserProfile | null> {
  if (!user) return null;

  let displayName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.user_metadata?.display_name ||
    (user.email ? user.email.split('@')[0] : 'Player');
  let avatarUrl =
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    null;

  try {
    const { data: userData } = await supabase
      .from('users')
      .select('display_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    if (userData?.display_name) {
      displayName = userData.display_name;
      if (userData.avatar_url) avatarUrl = userData.avatar_url;
    } else {
      await supabase.from('users').upsert(
        {
          id: user.id,
          email: user.email || '',
          display_name: displayName,
          avatar_url: avatarUrl,
        },
        { onConflict: 'id' }
      );
    }
  } catch (err) {
    console.warn('[Supabase Profile Sync Warning]', err);
  }

  return {
    id: user.id,
    email: user.email || '',
    displayName,
    avatarUrl,
  };
}

