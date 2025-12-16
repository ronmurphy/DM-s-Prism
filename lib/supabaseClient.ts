import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ajejyorvbtbxzprmcpuw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqZWp5b3J2YnRieHpwcm1jcHV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU4MzY1NTQsImV4cCI6MjA4MTQxMjU1NH0.K4SS7_c-wSQCbel9aYG_gsZOqEo4RzEpIP0LBlx6kIE';

export const supabase = createClient(supabaseUrl, supabaseKey);