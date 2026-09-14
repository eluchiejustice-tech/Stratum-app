import { ArrowLeft } from "lucide-react";

export default function TermsOfServicePage({ onBack, onContact }) {
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

        <h1 className="font-serif text-2xl mb-2">Terms of Service</h1>
        <p className="text-xs text-[#3D4148]/60 mb-8" style={{ fontFamily: "system-ui, sans-serif" }}>
          Last updated: September 2026
        </p>

        <div
          className="space-y-6 text-sm leading-relaxed text-[#15130F]"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <section>
            <h2 className="font-serif text-lg mb-2">1. Acceptance of these terms</h2>
            <p>
              By accessing or using Stratum (the "platform"), you agree to these Terms of Service.
              Stratum is currently an unregistered platform/business project operating in Nigeria's solid
              minerals sector. If you do not agree to these terms, please do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">2. What Stratum is</h2>
            <p>
              Stratum is a digital marketplace and discovery/connection platform. It allows sellers to
              list solid minerals for sale and allows buyers to discover listings and contact sellers.
              Stratum does not buy, sell, own, handle, ship, or take possession of any mineral listed on
              the platform, and is not a party to any transaction between a buyer and a seller.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">3. No guarantee of listings or transactions</h2>
            <p>
              Stratum does not guarantee the quality, grade, quantity, ownership, legality, or availability
              of any mineral listed on the platform. Stratum does not guarantee that any payment, delivery,
              or transaction between a buyer and seller will be completed, or that any counterparty will
              perform as expected. Users are responsible for conducting their own due diligence before
              entering into any transaction.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">4. Listing review</h2>
            <p>
              Listings may be reviewed by a moderator before being marked "verified" on the platform. This
              review is a basic check intended to reduce clearly invalid or incomplete listings and does
              not constitute an endorsement, certification, or guarantee of the accuracy of any listing or
              the legitimacy of any seller or buyer.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">5. User accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for
              all activity that occurs under your account. You must provide accurate information when
              creating listings or a profile.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">6. Prohibited use</h2>
            <p>
              You may not use Stratum to list minerals you do not have the legal right to sell, to engage
              in fraudulent or deceptive conduct, or to violate applicable Nigerian law.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">7. Limitation of liability</h2>
            <p>
              To the fullest extent permitted by law, Stratum and its operator are not liable for any loss,
              damage, or dispute arising from a transaction, communication, or interaction between users of
              the platform.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">8. Changes to these terms</h2>
            <p>
              These terms may be updated from time to time as the platform develops. Continued use of
              Stratum after changes are posted constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">9. Governing law</h2>
            <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">10. Contact</h2>
            <p>
              Questions about these terms can be sent through the{" "}
              <button onClick={onContact} className="underline hover:text-[#3D4148] transition">
                Contact page
              </button>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
