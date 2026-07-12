import { useState } from "react";
import { X } from "lucide-react";
import { MINERAL_COLORS } from "../utils/mineralColors";

export default function AddListingModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    mineral: "Gold",
    grade: "",
    quantity: "",
    state: "",
    lga: "",
    location: "",
    seller: "",
    company: "",
    contact: "",
    price: "",
    photoUrl: "",
  });

  const submit = () => {
    if (!form.grade || !form.quantity || !form.state || !form.location || !form.seller || !form.contact) return;
    onAdd(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#EDE8DC] w-full sm:max-w-md sm:rounded-lg rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-xl text-[#15130F]">New listing</h2>
          <button onClick={onClose} className="p-1 text-[#3D4148] hover:text-[#15130F]">
            <X size={20} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Mineral</label>
            <select
              value={form.mineral}
              onChange={(e) => setForm({ ...form, mineral: e.target.value })}
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            >
              {Object.keys(MINERAL_COLORS).map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Grade / spec</label>
            <input
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
              placeholder="e.g. 91.6% purity, unassayed"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Quantity</label>
            <input
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              placeholder="e.g. 2.5 kg, 40 tonnes"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">State</label>
            <input
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              placeholder="e.g. Ekiti, Nasarawa, Kaduna"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
              Local Government Area (optional)
            </label>
            <input
              value={form.lga}
              onChange={(e) => setForm({ ...form, lga: e.target.value })}
              placeholder="e.g. Jos North, Ijero"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Location</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Town, or mining community"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Seller name</label>
            <input
              value={form.seller}
              onChange={(e) => setForm({ ...form, seller: e.target.value })}
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Company (optional)</label>
            <input
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              placeholder="e.g. Adewale Minerals Co."
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Contact (phone or email)</label>
            <input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="e.g. +234... or you@company.com"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">Price</label>
            <input
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="e.g. $1,150/tonne or Negotiable"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wide text-[#3D4148]">
              Photo or assay report link (optional)
            </label>
            <input
              value={form.photoUrl}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              placeholder="Paste a Google Photos, Drive, or Imgur link"
              className="w-full mt-1 bg-white border border-[#3D4148]/20 rounded px-3 py-2 text-sm"
            />
            <p className="text-[10px] text-[#3D4148]/60 mt-1">
              Upload your photo/document to Google Photos or Drive first, set sharing to
              "Anyone with the link," then paste the link here.
            </p>
          </div>
        </div>
        <button
          onClick={submit}
          className="w-full mt-5 bg-[#15130F] text-[#EDE8DC] font-mono text-sm uppercase tracking-wide py-3 rounded hover:bg-[#3D4148] transition"
        >
          Submit for review
        </button>
        <p className="text-xs text-[#3D4148]/70 mt-2 text-center">
          New listings show as "Pending review" until your team verifies them.
        </p>
      </div>
    </div>
  );
}
