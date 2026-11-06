ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name_key text, ADD COLUMN IF NOT EXISTS security_question text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_name_key_uniq ON public.profiles (name_key) WHERE name_key IS NOT NULL;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, name_key, security_question)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1), 'Guest'),
    NULLIF(NEW.raw_user_meta_data->>'name_key',''), NULLIF(left(NEW.raw_user_meta_data->>'security_question',120),''))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.name_security_question(_name_key text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT security_question FROM public.profiles WHERE name_key = _name_key LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.name_security_question(text) TO anon, authenticated;