
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = NEW.id AND r.role = 'controller' AND r.company_id IS NULL
  ) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'controller');
  END IF;

  RETURN NEW;
END;
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'controller'::app_role
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = u.id AND r.role = 'controller' AND r.company_id IS NULL
);
