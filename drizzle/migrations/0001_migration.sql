CREATE OR REPLACE FUNCTION public.create_room(_name text) RETURNS public.rooms LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.rooms; c text; dn text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  LOOP
    c := upper(substr(translate(md5(random()::text || clock_timestamp()::text), '01', 'XZ'), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.rooms WHERE code = c);
  END LOOP;
  SELECT display_name INTO dn FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.rooms(name, code, host_id) VALUES (left(trim(_name),60), c, auth.uid()) RETURNING * INTO r;
  INSERT INTO public.room_members(room_id, user_id, display_name, status) VALUES (r.id, auth.uid(), COALESCE(dn,'Host'), 'approved');
  RETURN r;
END $$;