import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bvhmqqxpiuqlmsmmznyu.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2aG1xcXhwaXVxbG1zbW16bnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NzA1ODcsImV4cCI6MjA5NTQ0NjU4N30.gXVmJgwlAgBl2LgifTevU9ijKAvZtRZLmhaPI9-VuAw'

export const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey)
export const supabaseClient = supabaseAdmin
