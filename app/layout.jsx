export const metadata = {
  title: "Evolve Report Board",
  description: "Bug tracker for the Evolve staff team",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
