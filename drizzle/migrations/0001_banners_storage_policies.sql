alter table public.offers add column banner_path text;
comment on column public.offers.banner_url is 'DEPRECATED: replaced by banner_path (private storage)';

create policy "Admins read banners" on storage.objects for select to authenticated
  using (bucket_id = 'banners' and public.has_role(auth.uid(), 'admin'));
create policy "Admins upload banners" on storage.objects for insert to authenticated
  with check (bucket_id = 'banners' and public.has_role(auth.uid(), 'admin'));
create policy "Admins update banners" on storage.objects for update to authenticated
  using (bucket_id = 'banners' and public.has_role(auth.uid(), 'admin'));
create policy "Admins delete banners" on storage.objects for delete to authenticated
  using (bucket_id = 'banners' and public.has_role(auth.uid(), 'admin'));