/*
# Student Digital Locker — Database Schema

## Purpose
A secure digital locker where students store documents and personal info.
Each student only accesses their own data (multi-user, owner-scoped).

## New Tables
1. `documents`
   - `id` (uuid, PK)
   - `user_id` (uuid, FK → auth.users, defaults to authenticated user)
   - `name` (text, document name given by student)
   - `category` (text, one of: College ID, Certificates, Marksheets, Resume, Other)
   - `file_path` (text, path in the storage bucket)
   - `file_name` (text, original file name)
   - `file_size` (bigint, bytes)
   - `file_type` (text, MIME type)
   - `expiry_date` (date, nullable — for expiry reminders)
   - `created_at` (timestamptz)

2. `personal_info`
   - `id` (uuid, PK)
   - `user_id` (uuid, FK → auth.users, unique — one profile per student)
   - `full_name`, `date_of_birth`, `phone`, `address`, `course`, `branch`, `year`, `roll_number`, `updated_at`

## Storage
- Create bucket `student-documents` (private) for uploaded files.

## Security
- RLS enabled on both tables.
- Owner-scoped CRUD policies (TO authenticated, auth.uid() = user_id).
- Storage policies: authenticated users can manage only files in their own user-id folder.
*/

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint DEFAULT 0,
  file_type text DEFAULT '',
  expiry_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_documents" ON documents;
CREATE POLICY "select_own_documents" ON documents FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_documents" ON documents;
CREATE POLICY "insert_own_documents" ON documents FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_documents" ON documents;
CREATE POLICY "update_own_documents" ON documents FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_documents" ON documents;
CREATE POLICY "delete_own_documents" ON documents FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Personal info table
CREATE TABLE IF NOT EXISTS personal_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  date_of_birth date,
  phone text,
  address text,
  course text,
  branch text,
  year text,
  roll_number text,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE personal_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_personal_info" ON personal_info;
CREATE POLICY "select_own_personal_info" ON personal_info FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_personal_info" ON personal_info;
CREATE POLICY "insert_own_personal_info" ON personal_info FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_personal_info" ON personal_info;
CREATE POLICY "update_own_personal_info" ON personal_info FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_personal_info" ON personal_info;
CREATE POLICY "delete_own_personal_info" ON personal_info FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_personal_info_user_id ON personal_info(user_id);

-- Storage bucket for documents (private, max 10MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-documents',
  'student-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: each user manages only files under their own user-id folder
DROP POLICY IF EXISTS "Users can upload own documents" ON storage.objects;
CREATE POLICY "Users can upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'student-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read own documents" ON storage.objects;
CREATE POLICY "Users can read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'student-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete own documents" ON storage.objects;
CREATE POLICY "Users can delete own documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'student-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update own documents" ON storage.objects;
CREATE POLICY "Users can update own documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'student-documents' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'student-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
