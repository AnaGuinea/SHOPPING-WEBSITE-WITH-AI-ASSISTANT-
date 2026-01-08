-- Create table to track daily message usage
CREATE TABLE public.user_message_usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    usage_date date NOT NULL DEFAULT CURRENT_DATE,
    message_count integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE (user_id, usage_date)
);

-- Enable RLS
ALTER TABLE public.user_message_usage ENABLE ROW LEVEL SECURITY;

-- Users can only view their own usage
CREATE POLICY "Users can view their own usage"
ON public.user_message_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own usage records
CREATE POLICY "Users can insert their own usage"
ON public.user_message_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage records
CREATE POLICY "Users can update their own usage"
ON public.user_message_usage
FOR UPDATE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_message_usage_updated_at
BEFORE UPDATE ON public.user_message_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get or increment message count (SECURITY DEFINER for edge function use)
CREATE OR REPLACE FUNCTION public.increment_message_count(p_user_id uuid)
RETURNS TABLE(message_count integer, can_send boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
    v_free_limit integer := 3;
BEGIN
    -- Insert or update the message count for today
    INSERT INTO user_message_usage (user_id, usage_date, message_count)
    VALUES (p_user_id, CURRENT_DATE, 1)
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET 
        message_count = user_message_usage.message_count + 1,
        updated_at = now()
    RETURNING user_message_usage.message_count INTO v_count;
    
    RETURN QUERY SELECT v_count, (v_count <= v_free_limit);
END;
$$;

-- Create function to check current message count without incrementing
CREATE OR REPLACE FUNCTION public.get_message_count(p_user_id uuid)
RETURNS TABLE(message_count integer, can_send boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count integer;
    v_free_limit integer := 3;
BEGIN
    SELECT COALESCE(u.message_count, 0) INTO v_count
    FROM user_message_usage u
    WHERE u.user_id = p_user_id AND u.usage_date = CURRENT_DATE;
    
    IF v_count IS NULL THEN
        v_count := 0;
    END IF;
    
    RETURN QUERY SELECT v_count, (v_count < v_free_limit);
END;
$$;