CREATE OR REPLACE FUNCTION public.is_room_member(_room uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.room_members WHERE room_id = _room AND user_id = auth.uid() AND status = 'approved' AND moderation_action <> 'ban') $$;
CREATE OR REPLACE FUNCTION public.moderate_member(_room uuid, _user uuid, _action text, _seconds integer DEFAULT NULL, _reason text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_room_host(_room) THEN RAISE EXCEPTION 'Only the host can moderate members'; END IF;
 IF _user = auth.uid() THEN RAISE EXCEPTION 'The host cannot moderate themselves'; END IF;
 IF _action IS NULL OR _action NOT IN ('none','warn','mute','timeout','slow','kick','ban') THEN RAISE EXCEPTION 'Invalid moderation action'; END IF;
 IF _action IN ('mute','timeout','slow') AND (_seconds IS NULL OR _seconds < 1 OR _seconds > 604800) THEN RAISE EXCEPTION 'Choose a duration between 1 second and 7 days'; END IF;
 IF length(coalesce(_reason,'')) > 300 THEN RAISE EXCEPTION 'Reason is too long'; END IF;
 IF _action = 'kick' THEN DELETE FROM public.room_members WHERE room_id = _room AND user_id = _user;
 ELSE
 UPDATE public.room_members SET moderation_action = _action, moderation_until = CASE WHEN _action IN ('mute','timeout','slow') THEN clock_timestamp() + make_interval(secs => _seconds) ELSE NULL END, moderation_reason = CASE WHEN _action = 'none' THEN '' ELSE coalesce(_reason,'') END WHERE room_id = _room AND user_id = _user;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member no longer in room'; END IF;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.preserve_room_ban() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF OLD.moderation_action = 'ban' AND auth.uid() = OLD.user_id AND NOT public.is_room_host(OLD.room_id) THEN RAISE EXCEPTION 'Only the host can clear a ban'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER preserve_room_ban BEFORE DELETE ON public.room_members FOR EACH ROW EXECUTE FUNCTION public.preserve_room_ban();
CREATE OR REPLACE FUNCTION public.enforce_room_moderation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.room_members; last_sent timestamptz;
BEGIN
 SELECT * INTO m FROM public.room_members WHERE room_id = NEW.room_id AND user_id = auth.uid() FOR UPDATE;
 IF auth.uid() IS NULL OR NEW.user_id <> auth.uid() OR m.status IS DISTINCT FROM 'approved' OR m.moderation_action = 'ban' THEN RAISE EXCEPTION 'You cannot send messages in this room'; END IF;
 IF m.moderation_until > clock_timestamp() THEN
 IF m.moderation_action IN ('mute','timeout') THEN RAISE EXCEPTION 'You are restricted until %', m.moderation_until; END IF;
 IF m.moderation_action = 'slow' THEN SELECT max(created_at) INTO last_sent FROM public.messages WHERE room_id = NEW.room_id AND user_id = auth.uid(); IF last_sent > clock_timestamp() - interval '30 seconds' THEN RAISE EXCEPTION 'Slow mode: wait 30 seconds between messages'; END IF; END IF;
 END IF;
 NEW.created_at := clock_timestamp(); NEW.display_name := m.display_name; RETURN NEW;
END $$;