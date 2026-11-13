begin;

alter type public.notification_type
  add value if not exists 'trip_request_submitted';
alter type public.notification_type
  add value if not exists 'organizer_application_submitted';
alter type public.notification_type
  add value if not exists 'trip_submitted';
alter type public.notification_type
  add value if not exists 'report_submitted';

commit;
