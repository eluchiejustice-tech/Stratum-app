import { useState } from "react";
import { X } from "lucide-react";
import { updateProfile } from "../services/profiles";

export default function EditProfileModal({ userId, profile, onClose, onSaved }) {
  const [name, setName] = useState(profile?.name || "");
  const [company, setCompany] = useState(profile?.company || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [contact, setContact] = useState(profile?.contact || "");
  const [location, setLocation] = useState(profile?.location || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setError("");

    if (!name.trim()) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    const { error: updateError } = await updateProfile(userId, {
      name: name.trim(),
      company: company.trim() || null,
      bio: bio.trim() || null,
      contact: contact.trim() || null,
      location: location.trim() || null,
    });
    setSaving(false);

    if (updateError) {
      setError("Couldn't save your profile. Please try again.");
      return;
    }

    await onSaved?.();
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#EDE8DC] w-full max-w-sm rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-lg text-[#15130F]">Edit your profile</h2>
          <button onClick={onClose} className="p-1 text-[#3D4148] hover:text-[#15130F]">
            <X size={18} />
          </button>
        </div>

        <label
          className="block text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/60 mb-1"
        >
          Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm mb-3"
          autoFocus
        />

        <label
          className="block text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/60 mb-1"
        >
          Company / business name
        </label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="e.g. Beachcorp Minerals"
          className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm mb-3"
        />

        <label
          className="block text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/60 mb-1"
        >
          Bio
        </label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short description buyers will see on your profile"
          rows={3}
          className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm mb-3 resize-none"
        />

        <label
          className="block text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/60 mb-1"
        >
          Contact
        </label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="Phone, WhatsApp link, or email"
          className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm mb-3"
        />

        <label
          className="block text-[10px] font-mono uppercase tracking-wide text-[#3D4148]/60 mb-1"
        >
          Location
        </label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g. Jos, Plateau, Nigeria"
          className="w-full bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
        />

        {error && (
          <p className="text-xs text-[#8a3b3b] mt-3 font-mono">{error}</p>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-4 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-2.5 rounded hover:bg-[#3D4148] transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save profile"}
        </button>
      </div>
    </div>
  );
}
