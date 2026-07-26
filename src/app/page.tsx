import { Navbar } from "@/components/navbar/navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-screen items-center justify-center">
        <h1 className="text-4xl font-semibold tracking-tight">Nexona</h1>
      </main>
    </>
  );
}
