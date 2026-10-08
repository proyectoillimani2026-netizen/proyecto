import Link from "next/link";

export default function NotFound() {
  return (
    <main className="narrow center-card">
      <h1>No encontramos esa página</h1>
      <Link className="btn" href="/">Volver a la tienda</Link>
    </main>
  );
}
