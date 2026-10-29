ALTER TABLE public.room_members ADD COLUMN challenge_key text, ADD COLUMN challenge_id uuid, ADD COLUMN challenge_started_at timestamptz;
CREATE OR REPLACE FUNCTION public.assign_room_challenge(_room uuid, _user uuid, _key text, _reason text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_room_host(_room) OR _user = auth.uid() THEN RAISE EXCEPTION 'Only the host can assign challenges to other members'; END IF;
 IF _key IS NULL OR _key NOT IN ('riddle','banana','sequence','algebra','binary','roman','caesar','anagram','logic','fraction','prime','clock','percentage','geometry','word','reverse','typing','count','chess','video','slide','sort','memory','maze','lights') THEN RAISE EXCEPTION 'Unknown challenge'; END IF;
 IF length(coalesce(_reason,'')) > 300 THEN RAISE EXCEPTION 'Reason is too long'; END IF;
 UPDATE public.room_members SET moderation_action='challenge', moderation_until=NULL, moderation_reason=coalesce(_reason,''), challenge_key=_key, challenge_id=gen_random_uuid(), challenge_started_at=NULL WHERE room_id=_room AND user_id=_user AND status='approved' AND moderation_action <> 'ban';
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an approved, non-banned member'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.assign_room_challenge(uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_room_challenge(uuid,uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.preserve_room_ban() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF OLD.moderation_action IN ('ban','challenge') AND auth.uid() = OLD.user_id AND NOT public.is_room_host(OLD.room_id) THEN RAISE EXCEPTION 'Only the host can clear this restriction'; END IF;
 RETURN OLD;
END $$;
CREATE OR REPLACE FUNCTION public.enforce_room_moderation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.room_members; last_sent timestamptz;
BEGIN
 SELECT * INTO m FROM public.room_members WHERE room_id = NEW.room_id AND user_id = auth.uid() FOR UPDATE;
 IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() OR m.status IS DISTINCT FROM 'approved' OR m.moderation_action = 'ban' THEN RAISE EXCEPTION 'You cannot send messages in this room'; END IF;
 IF m.moderation_action='challenge' THEN RAISE EXCEPTION 'Complete your challenge or ask the host to forgive you'; END IF;
 IF m.moderation_until > clock_timestamp() THEN
 IF m.moderation_action IN ('mute','timeout') THEN RAISE EXCEPTION 'You are restricted until %', m.moderation_until; END IF;
 IF m.moderation_action = 'slow' THEN SELECT max(created_at) INTO last_sent FROM public.messages WHERE room_id = NEW.room_id AND user_id = auth.uid(); IF last_sent > clock_timestamp() - interval '30 seconds' THEN RAISE EXCEPTION 'Slow mode: wait 30 seconds between messages'; END IF; END IF;
 END IF;
 NEW.created_at := clock_timestamp(); NEW.display_name := m.display_name; RETURN NEW;
END $$;