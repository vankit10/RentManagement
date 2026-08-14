-- First, make sure the http extension is enabled so we can make API calls
create extension if not exists http with schema extensions;

-- Create the SMS Hook function
create or replace function public.send_auth_sms(event jsonb) 
returns void 
language plpgsql 
security definer
as $$
declare
  user_phone text;
  otp_code text;
  twofactor_api_key text := '343a995e-97e7-11f1-9cb1-0200cd936042';
  api_url text;
  http_response extensions.http_response;
begin
  -- Extract phone and OTP from the event payload
  user_phone := event->'user'->>'phone';
  otp_code := event->'sms'->>'otp';
  
  -- Construct the 2Factor API URL
  api_url := 'https://2factor.in/API/V1/' || twofactor_api_key || '/SMS/' || user_phone || '/' || otp_code;

  -- Make the HTTP GET request to 2Factor
  select * into http_response from extensions.http((
    'GET',
    api_url,
    array[]::extensions.http_header[],
    null,
    null
  ));

  -- You could add error logging here by checking http_response.status if needed
end;
$$;

-- Grant necessary permissions so Supabase Auth can execute it
grant execute on function public.send_auth_sms to supabase_auth_admin;
revoke execute on function public.send_auth_sms from authenticated, anon;
