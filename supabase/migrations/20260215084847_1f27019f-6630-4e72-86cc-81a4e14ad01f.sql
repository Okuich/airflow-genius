-- Enable realtime for training_jobs and ml_model_versions
ALTER PUBLICATION supabase_realtime ADD TABLE public.training_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ml_model_versions;