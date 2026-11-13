begin;

alter type public.notification_type
  add value if not exists 'report_reviewed';
alter type public.notification_type
  add value if not exists 'report_dismissed';

commit;
