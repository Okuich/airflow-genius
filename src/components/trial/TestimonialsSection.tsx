import { Star } from "lucide-react";

const TESTIMONIALS = [
  { quote: "FlowForge cut our HVAC design cycle from weeks to days.", author: "Maria Chen", title: "VP Engineering, AeroCool Systems" },
  { quote: "The AI anomaly detection caught a cleanroom excursion before it impacted production.", author: "James Okafor", title: "Facilities Director, PharmaTech" },
  { quote: "The AI Agent walked us through our first simulation setup in under 10 minutes.", author: "Priya Gupta", title: "CFD Engineer, ThermalWorks" },
];

export default function TestimonialsSection() {
  return (
    <section className="border-t border-border bg-muted/10">
      <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-3 gap-6">
        {TESTIMONIALS.map((t) => (
          <div key={t.author} className="rounded-xl border border-border p-6 bg-background">
            <div className="flex gap-0.5 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-primary text-primary" />
              ))}
            </div>
            <p className="text-sm text-foreground mb-4 italic">"{t.quote}"</p>
            <div>
              <p className="text-sm font-semibold text-foreground">{t.author}</p>
              <p className="text-xs text-muted-foreground">{t.title}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
