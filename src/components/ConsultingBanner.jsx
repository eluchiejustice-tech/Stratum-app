export default function ConsultingBanner() {
  return (
    <div className="mt-8 bg-[#15130F] text-[#EDE8DC] rounded-lg p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-[#B8922F] mb-1">
        Geology consulting
      </div>
      <div className="font-serif text-lg mb-1">Need a sample verified or a site assessed?</div>
      <p className="text-sm text-[#EDE8DC]/70 mb-3" style={{ fontFamily: "system-ui, sans-serif" }}>
        Book a paid consultation for grading, valuation, or export documentation support.
      </p>
      <div className="flex gap-2">
        <a
          href="https://wa.me/2348036142893?text=Hi%2C%20I%27d%20like%20to%20book%20a%20geology%20consultation."
          target="_blank"
          rel="noopener noreferrer"
          className="bg-[#EDE8DC] text-[#15130F] text-xs font-mono uppercase tracking-wide px-4 py-2 rounded hover:brightness-95 transition"
        >
          WhatsApp
        </a>
        <a
          href="mailto:stratum.oreledger@gmail.com?subject=Consultation%20Request&body=Hi%2C%20I%27d%20like%20to%20book%20a%20geology%20consultation."
          className="bg-transparent border border-[#EDE8DC]/40 text-[#EDE8DC] text-xs font-mono uppercase tracking-wide px-4 py-2 rounded hover:bg-[#EDE8DC]/10 transition"
        >
          Email
        </a>
      </div>
    </div>
  );
}
