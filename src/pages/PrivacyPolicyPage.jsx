import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage({ onBack, onContact }) {
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

        <h1 className="font-serif text-2xl mb-2">Privacy Policy</h1>
        <p className="text-xs text-[#3D4148]/60 mb-8" style={{ fontFamily: "system-ui, sans-serif" }}>
          Last updated: September 2026
        </p>

        <div
          className="space-y-6 text-sm leading-relaxed text-[#15130F]"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          <section>
            <h2 className="font-serif text-lg mb-2">1. About Stratum</h2>
            <p>
              Stratum ("Stratum," "the Stratum platform," "we," "us") is a digital marketplace and
              discovery platform that connects buyers and sellers in Nigeria's solid minerals sector.
              Stratum is not currently a registered or incorporated legal entity. This policy describes
              how the Stratum platform collects, uses, and protects information from people who use it.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">2. Information we collect</h2>
            <p>We collect the following categories of information when you use Stratum:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Account information you provide directly, such as your name, contact details, and company (where applicable).</li>
              <li>Authentication data from sign-in methods you choose, including email/password, Google, and Facebook.</li>
              <li>Listing content you submit, including mineral details, quantities, location, photographs, and any assay or supporting documents you upload.</li>
              <li>Usage information related to how listings are viewed and how buyers and sellers interact on the platform, used to help sellers understand engagement with their listings.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">3. How we use information</h2>
            <p>
              Information collected is used to operate the marketplace: creating and displaying listings,
              enabling buyers and sellers to find and contact each other, supporting the moderation and
              review of listings, and improving the platform over time. We do not sell personal information
              to third parties.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">4. Third-party services</h2>
            <p>
              Stratum relies on third-party infrastructure providers to operate, including Supabase for
              authentication, database, and file storage, and Google and Facebook for optional sign-in.
              These providers process data on our behalf or as part of the sign-in process you choose, and
              are subject to their own privacy practices.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">5. Listing verification</h2>
            <p>
              Listings submitted to Stratum may be reviewed by a moderator before appearing as "verified."
              This review process is intended to reduce obviously invalid or incomplete listings. It is not
              a guarantee of mineral quality, quantity, ownership, legality, availability, or that any
              transaction with a seller will be completed successfully.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">6. Data retention and your choices</h2>
            <p>
              You may request correction or removal of your account information by contacting us through
              the Contact page. We retain information for as long as your account is active or as needed to
              operate the platform.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">7. Governing jurisdiction</h2>
            <p>This policy is governed by the laws of the Federal Republic of Nigeria.</p>
          </section>

          <section>
            <h2 className="font-serif text-lg mb-2">8. Contact</h2>
            <p>
              Questions about this policy can be sent through the{" "}
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
