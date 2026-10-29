CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Guest',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1), 'Guest'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  host_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.room_members (
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  display_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id)
);
GRANT SELECT, UPDATE, DELETE ON public.room_members TO authenticated;
GRANT ALL ON public.room_members TO service_role;
ALTER TABLE public.room_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  display_name text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_room_host(_room uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rooms WHERE id = _room AND host_id = auth.uid()) $$;
CREATE OR REPLACE FUNCTION public.is_room_member(_room uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room AND user_id = auth.uid() AND status = 'approved') $$;
CREATE OR REPLACE FUNCTION public.has_room_row(_room uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room AND user_id = auth.uid()) $$;

CREATE POLICY "rooms read" ON public.rooms FOR SELECT TO authenticated USING (host_id = auth.uid() OR public.has_room_row(id));
CREATE POLICY "rooms delete host" ON public.rooms FOR DELETE TO authenticated USING (host_id = auth.uid());

CREATE POLICY "members read" ON public.room_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_room_host(room_id) OR public.is_room_member(room_id));
CREATE POLICY "members host update" ON public.room_members FOR UPDATE TO authenticated
  USING (public.is_room_host(room_id)) WITH CHECK (public.is_room_host(room_id));
CREATE POLICY "members delete" ON public.room_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_host(room_id));

CREATE POLICY "messages read" ON public.messages FOR SELECT TO authenticated USING (public.is_room_member(room_id));
CREATE POLICY "messages insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_room_member(room_id));

CREATE OR REPLACE FUNCTION public.create_room(_name text) RETURNS public.rooms LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rooms; c text; dn text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  LOOP
    c := upper(substr(translate(encode(gen_random_bytes(8),'base64'),'+/=0O1Il','XYZABCDE'),1,6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.rooms WHERE code = c);
  END LOOP;
  SELECT display_name INTO dn FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.rooms(name, code, host_id) VALUES (left(trim(_name),60), c, auth.uid()) RETURNING * INTO r;
  INSERT INTO public.room_members(room_id, user_id, display_name, status) VALUES (r.id, auth.uid(), COALESCE(dn,'Host'), 'approved');
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.request_join(_code text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid; dn text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  SELECT id INTO rid FROM public.rooms WHERE code = upper(trim(_code));
  IF rid IS NULL THEN RAISE EXCEPTION 'Room not found'; END IF;
  SELECT display_name INTO dn FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.room_members(room_id, user_id, display_name) VALUES (rid, auth.uid(), COALESCE(dn,'Guest'))
  ON CONFLICT (room_id, user_id) DO UPDATE SET status = CASE WHEN room_members.status='rejected' THEN 'pending' ELSE room_members.status END;
  RETURN rid;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_room(text), public.request_join(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.create_room(text), public.request_join(text) TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_members;