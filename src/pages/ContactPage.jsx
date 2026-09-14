import { ArrowLeft, Mail } from "lucide-react";

export default function ContactPage({ onBack }) {
  return (
    <div
      className="min-h-screen bg-[#EDE8DC] text-[#15130F]"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <div className="max-w-3xl mx-auto px-5 sm:px-8 py-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wide text-[#3D4148]/70 hover:text-[#15130F] transition mb-6"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <ArrowLeft size={14} /> Back to marketplace
        </button>

        <h1 className="font-serif text-2xl mb-6">Contact & Support</h1>

        <div
          className="space-y-4 text-sm leading-relaxed text-[#15130F]"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <div className="bg-white rounded-lg p-5 shadow-sm border border-[#3D4148]/10 flex items-start gap-3">
            <Mail size={18} className="text-[#3D4148]/60 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Email support</p>
              <p className="text-[#3D4148]/70 mt-1">
                A dedicated support email is being set up and will be published here shortly.
              </p>
            </div>
          </div>

          <p className="text-[#3D4148]/70">
            Stratum does not currently offer phone or WhatsApp support.
          </p>
        </div>
      </div>
    </div>
  );
}
