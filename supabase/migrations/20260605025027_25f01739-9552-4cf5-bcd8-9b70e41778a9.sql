
-- Extend donation_status enum
ALTER TYPE public.donation_status ADD VALUE IF NOT EXISTS 'assigned' AFTER 'claimed';

-- 1. donation_status_history
CREATE TABLE public.donation_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.donation_status_history TO authenticated;
GRANT ALL ON public.donation_status_history TO service_role;
ALTER TABLE public.donation_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "history visible to participants"
  ON public.donation_status_history FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.donations d
      WHERE d.id = donation_id
        AND (d.donor_id = auth.uid() OR d.claimed_by = auth.uid() OR public.has_role(auth.uid(),'admin'))
    )
  );

CREATE POLICY "authenticated can insert history rows"
  ON public.donation_status_history FOR INSERT TO authenticated
  WITH CHECK (changed_by IS NULL OR changed_by = auth.uid());

-- 2. trigger to auto-log status changes on donations
CREATE OR REPLACE FUNCTION public.log_donation_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.donation_status_history (donation_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status::text, NEW.donor_id);
  ELSIF (NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.donation_status_history (donation_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status::text, NEW.status::text, auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_log_donation_status
AFTER INSERT OR UPDATE OF status ON public.donations
FOR EACH ROW EXECUTE FUNCTION public.log_donation_status_change();

-- 3. volunteer_applications
CREATE TABLE public.volunteer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text NOT NULL,
  vehicle_type text NOT NULL,
  license_number text,
  city text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.volunteer_applications TO authenticated;
GRANT ALL ON public.volunteer_applications TO service_role;
ALTER TABLE public.volunteer_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own application or admin all"
  ON public.volunteer_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "user inserts own application"
  ON public.volunteer_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin updates applications"
  ON public.volunteer_applications FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_va_updated
BEFORE UPDATE ON public.volunteer_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. assignments
CREATE TABLE public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id uuid NOT NULL,
  volunteer_id uuid NOT NULL,
  assigned_by uuid,
  status text NOT NULL DEFAULT 'assigned',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  proof_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.assignments TO authenticated;
GRANT ALL ON public.assignments TO service_role;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assignment readable by participants"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    auth.uid() = volunteer_id
    OR public.has_role(auth.uid(),'admin')
    OR EXISTS (
      SELECT 1 FROM public.donations d
      WHERE d.id = donation_id AND (d.donor_id = auth.uid() OR d.claimed_by = auth.uid())
    )
  );

CREATE POLICY "ngo or admin creates assignment"
  ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (
    assigned_by = auth.uid()
    AND (
      public.has_role(auth.uid(),'admin')
      OR EXISTS (
        SELECT 1 FROM public.donations d
        WHERE d.id = donation_id AND d.claimed_by = auth.uid()
      )
    )
  );

CREATE POLICY "volunteer or admin updates assignment"
  ON public.assignments FOR UPDATE TO authenticated
  USING (auth.uid() = volunteer_id OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (auth.uid() = volunteer_id OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_assign_updated
BEFORE UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user marks own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6. realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.donation_status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
