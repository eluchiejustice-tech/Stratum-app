import { useEffect } from "react";
import { X } from "lucide-react";

// Generic media/document viewer overlay. Deliberately minimal: it only
// owns the overlay, close button, Escape/click-outside handling, and
// background-scroll lock. What's actually displayed (a single image, a
// PDF iframe, or a full photo gallery with its own prev/next controls)
// is entirely up to the caller via `children` — this component has no
// opinion about galleries, documents, or any specific media type.
export default function MediaViewerModal({ onClose, children, label = "Media viewer" }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);

    // Prevent background scroll/interaction while the modal is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-10"
        aria-label="Close"
      >
        <X size={28} />
      </button>

      {/* Click-outside-to-close relies on the overlay's own onClick above;
          stopping propagation here means clicks on the actual content
          (image, iframe, nav buttons) don't bubble up and trigger it. */}
      <div
        className="max-w-[92vw] max-h-[85vh] w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
