import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# 1. Create storage buckets
cur.execute("""
INSERT INTO storage.buckets (id, name, public) 
VALUES 
    ('veriguard-documents', 'veriguard-documents', true),
    ('veriguard-faces', 'veriguard-faces', true),
    ('veriguard-heatmaps', 'veriguard-heatmaps', true)
ON CONFLICT (id) DO UPDATE SET public = true;
""")

# 2. Allow public access to all objects in these buckets
cur.execute("""
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Public Access VeriGuard'
    ) THEN
        CREATE POLICY "Public Access VeriGuard" ON storage.objects
        FOR ALL USING (bucket_id IN ('veriguard-documents', 'veriguard-faces', 'veriguard-heatmaps'))
        WITH CHECK (bucket_id IN ('veriguard-documents', 'veriguard-faces', 'veriguard-heatmaps'));
    END IF;
END $$;
""")

conn.commit()
print("Storage buckets ('veriguard-documents', 'veriguard-faces', 'veriguard-heatmaps') and RLS policies created!")
cur.close()
conn.close()
