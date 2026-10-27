-- An owner must be able to SELECT a just-inserted room in INSERT ... RETURNING.
-- Membership-based visibility remains restricted to participants.
drop policy if exists "rooms_participants_read" on public.game_rooms;
create policy "rooms_participants_read" on public.game_rooms
for select to authenticated using (
  owner_id=(select auth.uid()) or ays_rooms_private.room_can_view(id)
);
