
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'donor', 'ngo', 'volunteer');
CREATE TYPE public.donation_status AS ENUM ('available', 'claimed', 'picked_up', 'completed', 'expired', 'cancelled');
CREATE TYPE public.claim_status AS ENUM ('claimed', 'picked_up', 'completed', 'cancelled');

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  org_name TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- handle_new_user trigger: create profile + default donor role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role public.app_role;
  _role_text TEXT;
BEGIN
  INSERT INTO public.profiles (id, display_name, org_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'org_name',
    NEW.raw_user_meta_data->>'phone'
  );
  _role_text := COALESCE(NEW.raw_user_meta_data->>'role', 'donor');
  IF _role_text NOT IN ('donor', 'ngo', 'volunteer') THEN
    _role_text := 'donor';
  END IF;
  _role := _role_text::public.app_role;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, _role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- donations
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  food_type TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'servings',
  pickup_address TEXT NOT NULL,
  city TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  pickup_from TIMESTAMPTZ NOT NULL,
  pickup_to TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  image_url TEXT,
  status public.donation_status NOT NULL DEFAULT 'available',
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "donations readable by authenticated" ON public.donations FOR SELECT TO authenticated USING (true);
CREATE POLICY "donors create donations" ON public.donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = donor_id);
CREATE POLICY "donor or claimer or admin update" ON public.donations FOR UPDATE TO authenticated
  USING (auth.uid() = donor_id OR auth.uid() = claimed_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = donor_id OR auth.uid() = claimed_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "donor or admin delete" ON public.donations FOR DELETE TO authenticated
  USING (auth.uid() = donor_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER donations_updated_at BEFORE UPDATE ON public.donations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX donations_status_idx ON public.donations(status);
CREATE INDEX donations_donor_idx ON public.donations(donor_id);

-- donation_claims (history/log)
CREATE TABLE public.donation_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  ngo_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.claim_status NOT NULL DEFAULT 'claimed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.donation_claims TO authenticated;
GRANT ALL ON public.donation_claims TO service_role;
ALTER TABLE public.donation_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claims readable by participants or admin" ON public.donation_claims FOR SELECT TO authenticated
  USING (
    auth.uid() = ngo_id
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.donations d WHERE d.id = donation_id AND d.donor_id = auth.uid())
  );
CREATE POLICY "ngo creates claim" ON public.donation_claims FOR INSERT TO authenticated WITH CHECK (auth.uid() = ngo_id);
CREATE POLICY "ngo or admin updates claim" ON public.donation_claims FOR UPDATE TO authenticated
  USING (auth.uid() = ngo_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = ngo_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER claims_updated_at BEFORE UPDATE ON public.donation_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.donations;
