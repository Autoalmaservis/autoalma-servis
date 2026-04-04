export const metadata = {
  title: 'Online Rezervácia | AutoAlma',
};

export default function ObjednavkaLayout({ children }) {
  return (
    <div className="min-h-screen bg-black w-full overflow-x-hidden">
      {children}
    </div>
  );
}