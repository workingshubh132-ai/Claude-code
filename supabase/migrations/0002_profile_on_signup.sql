-- Auto-create a profiles row when a new auth user signs up.
-- Expects role/display_name to be passed as signup metadata:
--   supabase.auth.signUp({ email, password, options: { data: { role, display_name } } })

create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, role, display_name)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'owner'),
    new.raw_user_meta_data->>'display_name'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
