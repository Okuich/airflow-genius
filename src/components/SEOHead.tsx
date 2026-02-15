import { useEffect } from "react";

interface SEOHeadProps {
  title: string;
  description: string;
}

export function SEOHead({ title, description }: SEOHeadProps) {
  useEffect(() => {
    document.title = title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", description);
  }, [title, description]);

  return null;
}
