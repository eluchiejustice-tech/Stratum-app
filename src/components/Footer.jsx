export default function Footer({ onPrivacy, onTerms, onContact }) {
  return (
    <footer className="bg-[#15130F] text-[#EDE8DC]/60 px-5 py-6 sm:px-8 mt-auto">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div
          className="font-mono uppercase tracking-wide"
          style={{ fontFamily: "system-ui, sans-serif" }}
        >
          © {new Date().getFullYear()} Stratum
        </div>
        <nav className="flex items-center gap-4 font-mono uppercase tracking-wide">
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              onPrivacy();
            }}
            className="hover:text-[#EDE8DC] transition"
          >
            Privacy
          </a>
          <a
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              onTerms();
            }}
            className="hover:text-[#EDE8DC] transition"
          >
            Terms
          </a>
          <a
            href="/contact"
            onClick={(e) => {
              e.preventDefault();
              onContact();
            }}
            className="hover:text-[#EDE8DC] transition"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
