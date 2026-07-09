export default function CoreSample({ bands }) {
  return (
    <div className="flex gap-[2px] h-16 w-6 rounded-sm overflow-hidden shrink-0 shadow-inner">
      {bands.map((c, i) => (
        <div key={i} style={{ backgroundColor: c }} className="flex-1" />
      ))}
    </div>
  );
}
