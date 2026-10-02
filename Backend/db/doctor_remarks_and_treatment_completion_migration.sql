-- Migration: Add doctor remarks, suggestions, prescription, and treatment_status columns to appointments and packages
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS doctor_remarks TEXT,
ADD COLUMN IF NOT EXISTS doctor_suggestions TEXT,
ADD COLUMN IF NOT EXISTS doctor_prescription TEXT,
ADD COLUMN IF NOT EXISTS treatment_status VARCHAR(50) DEFAULT 'active';

ALTER TABLE public.therapy_booking_packages
ADD COLUMN IF NOT EXISTS treatment_status VARCHAR(50) DEFAULT 'active';
