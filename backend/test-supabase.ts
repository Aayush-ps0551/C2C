import { createClient } from '@supabase/supabase-js';

const url = 'https://aaeosmakfevucyuyibxb.supabase.co';
const key = 'sb_publishable_coSB9UFbiDk6jqfHKTViLw_AR-QCAZR';

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.auth.signUp({
    email: 'test' + Date.now() + '@gmail.com',
    password: 'password123'
  });
  
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Success:', data.user?.id);
  }
}

test();
