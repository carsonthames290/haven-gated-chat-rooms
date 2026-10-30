CREATE OR REPLACE FUNCTION public.chess_attacked(b text, sq int, by_color text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  f int := sq % 8; r int := sq / 8; nf int; nr int; i int; p text;
  kdf int[] := '{1,2,2,1,-1,-2,-2,-1}'; kdr int[] := '{2,1,-1,-2,-2,-1,1,2}';
  ddf int[] := '{1,-1,0,0,1,1,-1,-1}'; ddr int[] := '{0,0,1,-1,1,-1,1,-1}';
  pn text; kn text; kg text; rk text; bs text; qn text;
BEGIN
  IF by_color = 'w' THEN pn:='P'; kn:='N'; kg:='K'; rk:='R'; bs:='B'; qn:='Q';
    IF r > 0 AND f > 0 AND substr(b, (r-1)*8+f, 1) = 'P' THEN RETURN true; END IF;
    IF r > 0 AND f < 7 AND substr(b, (r-1)*8+f+2, 1) = 'P' THEN RETURN true; END IF;
  ELSE pn:='p'; kn:='n'; kg:='k'; rk:='r'; bs:='b'; qn:='q';
    IF r < 7 AND f > 0 AND substr(b, (r+1)*8+f, 1) = 'p' THEN RETURN true; END IF;
    IF r < 7 AND f < 7 AND substr(b, (r+1)*8+f+2, 1) = 'p' THEN RETURN true; END IF;
  END IF;
  FOR i IN 1..8 LOOP
    nf := f + kdf[i]; nr := r + kdr[i];
    IF nf BETWEEN 0 AND 7 AND nr BETWEEN 0 AND 7 AND substr(b, nr*8+nf+1, 1) = kn THEN RETURN true; END IF;
    nf := f + ddf[i]; nr := r + ddr[i];
    IF nf BETWEEN 0 AND 7 AND nr BETWEEN 0 AND 7 AND substr(b, nr*8+nf+1, 1) = kg THEN RETURN true; END IF;
  END LOOP;
  FOR i IN 1..8 LOOP
    nf := f + ddf[i]; nr := r + ddr[i];
    WHILE nf BETWEEN 0 AND 7 AND nr BETWEEN 0 AND 7 LOOP
      p := substr(b, nr*8+nf+1, 1);
      IF p <> '.' THEN
        IF p = qn OR (i <= 4 AND p = rk) OR (i > 4 AND p = bs) THEN RETURN true; END IF;
        EXIT;
      END IF;
      nf := nf + ddf[i]; nr := nr + ddr[i];
    END LOOP;
  END LOOP;
  RETURN false;
END $$;

CREATE OR REPLACE FUNCTION public.chess_apply(b text, turn text, castling text, ep int, fr int, t int, promo text, OUT nb text, OUT nc text, OUT nep int)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE p text := substr(b, fr+1, 1);
BEGIN
  nb := b;
  IF lower(p) = 'p' AND t = ep AND substr(b, t+1, 1) = '.' THEN
    nb := overlay(nb placing '.' from (CASE WHEN turn = 'w' THEN t-8 ELSE t+8 END)+1 for 1);
  END IF;
  nb := overlay(nb placing (CASE WHEN promo IS NULL THEN p WHEN turn = 'w' THEN upper(promo) ELSE promo END) from t+1 for 1);
  nb := overlay(nb placing '.' from fr+1 for 1);
  IF lower(p) = 'k' AND abs(t - fr) = 2 THEN
    IF t > fr THEN nb := overlay(overlay(nb placing '.' from fr+4 for 1) placing (CASE WHEN turn='w' THEN 'R' ELSE 'r' END) from fr+2 for 1);
    ELSE nb := overlay(overlay(nb placing '.' from fr-3 for 1) placing (CASE WHEN turn='w' THEN 'R' ELSE 'r' END) from fr for 1);
    END IF;
  END IF;
  nc := castling;
  IF p = 'K' THEN nc := replace(replace(nc, 'K', ''), 'Q', ''); END IF;
  IF p = 'k' THEN nc := replace(replace(nc, 'k', ''), 'q', ''); END IF;
  IF fr = 0 OR t = 0 THEN nc := replace(nc, 'Q', ''); END IF;
  IF fr = 7 OR t = 7 THEN nc := replace(nc, 'K', ''); END IF;
  IF fr = 56 OR t = 56 THEN nc := replace(nc, 'q', ''); END IF;
  IF fr = 63 OR t = 63 THEN nc := replace(nc, 'k', ''); END IF;
  nep := CASE WHEN lower(p) = 'p' AND abs(t - fr) = 16 THEN (fr + t) / 2 ELSE -1 END;
END $$;

CREATE OR REPLACE FUNCTION public.chess_moves(b text, turn text, castling text, ep int)
RETURNS TABLE(mf int, mt int, mp text, mc text, mi int)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  sq int; f int; r int; p text; lp text; tp text; nf int; nr int; i int; j int; dir int; tgt int;
  them text := CASE WHEN turn = 'w' THEN 'b' ELSE 'w' END;
  kdf int[] := '{1,2,2,1,-1,-2,-2,-1}'; kdr int[] := '{2,1,-1,-2,-2,-1,1,2}';
  ddf int[] := '{1,-1,0,0,1,1,-1,-1}'; ddr int[] := '{0,0,1,-1,1,-1,1,-1}';
  ct int[]; cc text[]; lo int; hi int; promos text[] := '{n,b,r,q}';
  app record; ks int; kchar text := CASE WHEN turn = 'w' THEN 'K' ELSE 'k' END;
BEGIN
  FOR sq IN 0..63 LOOP
    p := substr(b, sq+1, 1);
    CONTINUE WHEN p = '.' OR (turn = 'w') <> (p = upper(p));
    lp := lower(p); f := sq % 8; r := sq / 8; ct := '{}'; cc := '{}';
    IF lp = 'p' THEN
      dir := CASE WHEN turn = 'w' THEN 1 ELSE -1 END;
      tgt := sq + 8*dir;
      IF substr(b, tgt+1, 1) = '.' THEN
        ct := ct || tgt; cc := cc || NULL::text;
        IF r = (CASE WHEN turn='w' THEN 1 ELSE 6 END) AND substr(b, tgt+8*dir+1, 1) = '.' THEN ct := ct || (tgt+8*dir); cc := cc || NULL::text; END IF;
      END IF;
      FOREACH i IN ARRAY ARRAY[-1, 1] LOOP
        nf := f + i; CONTINUE WHEN nf < 0 OR nf > 7;
        tgt := (r+dir)*8 + nf; tp := substr(b, tgt+1, 1);
        IF tp <> '.' AND (turn = 'w') = (tp = lower(tp)) THEN ct := ct || tgt; cc := cc || lower(tp);
        ELSIF tgt = ep THEN ct := ct || tgt; cc := cc || 'p'::text; END IF;
      END LOOP;
    ELSIF lp IN ('n', 'k') THEN
      FOR i IN 1..8 LOOP
        IF lp = 'n' THEN nf := f + kdf[i]; nr := r + kdr[i]; ELSE nf := f + ddf[i]; nr := r + ddr[i]; END IF;
        CONTINUE WHEN nf < 0 OR nf > 7 OR nr < 0 OR nr > 7;
        tp := substr(b, nr*8+nf+1, 1);
        IF tp = '.' THEN ct := ct || (nr*8+nf); cc := cc || NULL::text;
        ELSIF (turn = 'w') = (tp = lower(tp)) THEN ct := ct || (nr*8+nf); cc := cc || lower(tp); END IF;
      END LOOP;
      IF lp = 'k' AND sq = (CASE WHEN turn='w' THEN 4 ELSE 60 END) AND NOT chess_attacked(b, sq, them) THEN
        IF strpos(castling, CASE WHEN turn='w' THEN 'K' ELSE 'k' END) > 0 AND substr(b, sq+2, 1) = '.' AND substr(b, sq+3, 1) = '.'
           AND NOT chess_attacked(b, sq+1, them) AND NOT chess_attacked(b, sq+2, them) THEN ct := ct || (sq+2); cc := cc || NULL::text; END IF;
        IF strpos(castling, CASE WHEN turn='w' THEN 'Q' ELSE 'q' END) > 0 AND substr(b, sq, 1) = '.' AND substr(b, sq-1, 1) = '.' AND substr(b, sq-2, 1) = '.'
           AND NOT chess_attacked(b, sq-1, them) AND NOT chess_attacked(b, sq-2, them) THEN ct := ct || (sq-2); cc := cc || NULL::text; END IF;
      END IF;
    ELSE
      lo := CASE WHEN lp = 'b' THEN 5 ELSE 1 END; hi := CASE WHEN lp = 'r' THEN 4 ELSE 8 END;
      FOR i IN lo..hi LOOP
        nf := f + ddf[i]; nr := r + ddr[i];
        WHILE nf BETWEEN 0 AND 7 AND nr BETWEEN 0 AND 7 LOOP
          tp := substr(b, nr*8+nf+1, 1);
          IF tp = '.' THEN ct := ct || (nr*8+nf); cc := cc || NULL::text;
          ELSE
            IF (turn = 'w') = (tp = lower(tp)) THEN ct := ct || (nr*8+nf); cc := cc || lower(tp); END IF;
            EXIT;
          END IF;
          nf := nf + ddf[i]; nr := nr + ddr[i];
        END LOOP;
      END LOOP;
    END IF;
    FOR j IN 1..coalesce(array_length(ct, 1), 0) LOOP
      FOR i IN 1..(CASE WHEN lp = 'p' AND ct[j] / 8 IN (0, 7) THEN 4 ELSE 1 END) LOOP
        mp := CASE WHEN lp = 'p' AND ct[j] / 8 IN (0, 7) THEN promos[i] ELSE NULL END;
        SELECT * INTO app FROM chess_apply(b, turn, castling, ep, sq, ct[j], mp);
        ks := strpos(app.nb, kchar) - 1;
        IF ks >= 0 AND NOT chess_attacked(app.nb, ks, them) THEN
          mf := sq; mt := ct[j]; mc := cc[j]; mi := i - 1; RETURN NEXT;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.chess_replay(moves text[], OUT valid boolean, OUT mated boolean, OUT board text)
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  b text := 'RNBQKBNRPPPPPPPP' || repeat('.', 32) || 'pppppppprnbqkbnr';
  cas text := 'KQkq'; ep int := -1; m text; fr int; t int; pr text; mv record; app record; over boolean := false;
BEGIN
  valid := false; mated := false;
  IF moves IS NULL OR array_length(moves, 1) IS NULL OR array_length(moves, 1) > 400 THEN board := b; RETURN; END IF;
  FOREACH m IN ARRAY moves LOOP
    IF over OR m IS NULL OR m !~ '^[a-h][1-8][a-h][1-8][nbrq]?$' THEN board := NULL; RETURN; END IF;
    fr := (ascii(substr(m,1,1)) - 97) + (substr(m,2,1)::int - 1) * 8;
    t := (ascii(substr(m,3,1)) - 97) + (substr(m,4,1)::int - 1) * 8;
    pr := nullif(substr(m, 5, 1), '');
    SELECT * INTO mv FROM chess_moves(b, 'w', cas, ep) x WHERE x.mf = fr AND x.mt = t AND x.mp IS NOT DISTINCT FROM pr LIMIT 1;
    IF NOT FOUND THEN board := NULL; RETURN; END IF;
    SELECT * INTO app FROM chess_apply(b, 'w', cas, ep, fr, t, pr); b := app.nb; cas := app.nc; ep := app.nep;
    SELECT * INTO mv FROM chess_moves(b, 'b', cas, ep) x
      ORDER BY CASE x.mc WHEN 'p' THEN 1 WHEN 'n' THEN 3 WHEN 'b' THEN 3 WHEN 'r' THEN 5 WHEN 'q' THEN 9 WHEN 'k' THEN 100 ELSE 0 END DESC,
        x.mf % 8, x.mf / 8, x.mt % 8, x.mt / 8, x.mi LIMIT 1;
    IF NOT FOUND THEN
      over := true; mated := chess_attacked(b, strpos(b, 'k') - 1, 'w');
    ELSE
      SELECT * INTO app FROM chess_apply(b, 'b', cas, ep, mv.mf, mv.mt, mv.mp); b := app.nb; cas := app.nc; ep := app.nep;
      IF NOT EXISTS (SELECT 1 FROM chess_moves(b, 'w', cas, ep)) THEN over := true; END IF;
    END IF;
  END LOOP;
  valid := true; board := b;
END $$;

REVOKE ALL ON FUNCTION public.chess_attacked(text, int, text), public.chess_apply(text, text, text, int, int, int, text), public.chess_moves(text, text, text, int), public.chess_replay(text[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_room_challenge(_key text, _challenge_id uuid, _answer text, _moves text[], _steps int[])
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  expected text; a text := lower(regexp_replace(coalesce(_answer, ''), '^\s+|\s+$', '', 'g'));
  seed bigint := 7; c text; i int; s int; e int; board int[]; tmp int; pos int; ny int; nx int; m text;
  maze text := '......###....#.##.#......';
BEGIN
  expected := CASE _key
    WHEN 'riddle' THEN 'piano' WHEN 'banana' THEN '9' WHEN 'sequence' THEN '42' WHEN 'algebra' THEN '7'
    WHEN 'binary' THEN '45' WHEN 'roman' THEN '44' WHEN 'caesar' THEN 'hello' WHEN 'anagram' THEN 'silent'
    WHEN 'logic' THEN '3' WHEN 'fraction' THEN '5/6' WHEN 'prime' THEN '29' WHEN 'clock' THEN '16:10'
    WHEN 'percentage' THEN '90' WHEN 'geometry' THEN '70' WHEN 'word' THEN 'short' WHEN 'reverse' THEN 'ananab'
    WHEN 'typing' THEN 'i solemnly apologize to the council of geese.' WHEN 'count' THEN '6' WHEN 'video' THEN '1/6' END;
  IF expected IS NOT NULL THEN RETURN a = expected; END IF;
  IF _key = 'chess' THEN RETURN coalesce((SELECT r.valid AND r.mated FROM chess_replay(_moves) r), false); END IF;
  IF _key = 'sort' THEN RETURN _steps = ARRAY[3,8,13,21,34,55]; END IF;
  IF _key = 'memory' THEN
    FOREACH c IN ARRAY regexp_split_to_array(_challenge_id::text, '') LOOP seed := (seed * 31 + ascii(c)) % 4294967296; END LOOP;
    board := '{}';
    FOR i IN 1..6 LOOP seed := (seed * 1664525 + 1013904223) % 4294967296; board := board || (seed % 4)::int; END LOOP;
    RETURN _steps = board;
  END IF;
  IF _key = 'maze' THEN
    pos := 0;
    FOREACH m IN ARRAY coalesce(_moves, '{}') LOOP
      ny := pos / 5 + CASE m WHEN 'U' THEN -1 WHEN 'D' THEN 1 ELSE 0 END;
      nx := pos % 5 + CASE m WHEN 'L' THEN -1 WHEN 'R' THEN 1 ELSE 0 END;
      IF ny BETWEEN 0 AND 4 AND nx BETWEEN 0 AND 4 AND substr(maze, ny*5+nx+1, 1) = '.' THEN pos := ny*5+nx; END IF;
    END LOOP;
    RETURN pos = 24;
  END IF;
  IF _key = 'lights' THEN
    FOR i IN 0..8 LOOP
      tmp := 0;
      FOREACH s IN ARRAY (ARRAY[0,4,8] || coalesce(_steps, '{}')) LOOP
        IF abs(i/3 - s/3) + abs(i%3 - s%3) <= 1 THEN tmp := tmp + 1; END IF;
      END LOOP;
      IF tmp % 2 = 1 THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END IF;
  IF _key = 'slide' THEN
    board := ARRAY[1,2,3,4,0,6,7,5,8];
    FOREACH s IN ARRAY coalesce(_steps, '{}') LOOP
      IF s > 8 THEN RETURN false; END IF;
      e := array_position(board, 0) - 1;
      IF abs(e/3 - s/3) + abs(e%3 - s%3) = 1 THEN board[e+1] := board[s+1]; board[s+1] := 0; END IF;
    END LOOP;
    RETURN board = ARRAY[1,2,3,4,5,6,7,8,0];
  END IF;
  RETURN false;
END $$;
REVOKE ALL ON FUNCTION public.validate_room_challenge(text, uuid, text, text[], int[]) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.start_room_challenge(_room_id uuid, _challenge_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in again.'; END IF;
  UPDATE room_members SET challenge_started_at = coalesce(challenge_started_at, now())
    WHERE room_id = _room_id AND user_id = auth.uid() AND challenge_id = _challenge_id AND moderation_action = 'challenge';
  IF NOT FOUND THEN RAISE EXCEPTION 'This challenge is no longer active'; END IF;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.complete_room_challenge(_room_id uuid, _challenge_id uuid, _answer text DEFAULT NULL, _moves text[] DEFAULT NULL, _steps int[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE mem record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in again.'; END IF;
  IF length(_answer) > 500 OR array_length(_moves, 1) > 400 OR array_length(_steps, 1) > 2000 THEN RAISE EXCEPTION 'Answer is too long'; END IF;
  SELECT challenge_key, challenge_id, challenge_started_at, moderation_action INTO mem FROM room_members
    WHERE room_id = _room_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND OR mem.challenge_id IS DISTINCT FROM _challenge_id OR mem.moderation_action <> 'challenge' OR mem.challenge_key IS NULL THEN
    RAISE EXCEPTION 'This challenge is no longer active';
  END IF;
  IF NOT validate_room_challenge(mem.challenge_key, _challenge_id, _answer, _moves, _steps) THEN
    RETURN jsonb_build_object('completed', false, 'message', 'Not quite! The council grants unlimited retries.');
  END IF;
  IF mem.challenge_key = 'video' AND (mem.challenge_started_at IS NULL OR now() - mem.challenge_started_at < interval '40 seconds') THEN
    RETURN jsonb_build_object('completed', false, 'message', 'Class is still in session. Finish the video first.');
  END IF;
  UPDATE room_members SET moderation_action = 'none', moderation_reason = '', challenge_key = NULL, challenge_id = NULL, challenge_started_at = NULL
    WHERE room_id = _room_id AND user_id = auth.uid();
  RETURN jsonb_build_object('completed', true, 'message', 'Sentence served. Welcome back, menace.');
END $$;
REVOKE ALL ON FUNCTION public.start_room_challenge(uuid, uuid), public.complete_room_challenge(uuid, uuid, text, text[], int[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_room_challenge(uuid, uuid), public.complete_room_challenge(uuid, uuid, text, text[], int[]) TO authenticated;