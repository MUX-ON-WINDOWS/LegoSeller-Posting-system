import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ArrowLeft, BarChart3, CircleDollarSign, ImagePlus, LayoutDashboard, PackagePlus, Sparkles } from "lucide-react";

const initialMetrics = [
  { label: "Actieve advertenties", value: "0", icon: LayoutDashboard },
  { label: "Verkocht", value: "0", icon: BarChart3 },
  { label: "Totale vraagprijs", value: "€ 0", icon: CircleDollarSign },
];

export default function App() {
  const [showForm, setShowForm] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [metrics, setMetrics] = useState(initialMetrics);

  function handlePhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setPhotos(selected.slice(0, 20));
  }

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (photos.length < 1) {
      setMessage("Selecteer minimaal één foto.");
      return;
    }
    setSaving(true);
    const form = new FormData(event.currentTarget);
    photos.forEach((photo) => form.append("photos", photo));
    try {
      const apiUrl = (import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:8000`).replace(/\/+$/, "");
      const response = await fetch(`${apiUrl}/listings`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(error?.detail ?? "Opslaan is mislukt.");
      }
      const listing = await response.json();
      let resultMessage = "Advertentie opgeslagen.";
      const analysisResponse = await fetch(`${apiUrl}/listings/${listing.id}/analyze`, { method: "POST" });
      if (analysisResponse.ok) {
        const recognition = await analysisResponse.json();
        resultMessage = recognition.set_number
          ? `Advertentie opgeslagen. Herkend: set ${recognition.set_number}.`
          : "Advertentie opgeslagen. Geen setnummer betrouwbaar herkend.";
      } else if (analysisResponse.status === 503) {
        resultMessage = "Advertentie opgeslagen. AI is nog niet geconfigureerd.";
      }
      setMetrics((current) => current.map((metric) =>
        metric.label === "Actieve advertenties" ? { ...metric, value: String(Number(metric.value) + 1) } : metric,
      ));
      setPhotos([]);
      setMessage(resultMessage);
      event.currentTarget.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  const openForm = () => {
    setMessage("");
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside className="fixed hidden h-full w-64 border-r border-slate-200 bg-white p-6 lg:block">
        <div className="flex items-center gap-3 text-xl font-bold">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white">
            <Sparkles size={20} />
          </span>
          LegoSell <span className="text-blue-600">AI</span>
        </div>
        <nav className="mt-12 space-y-2 text-sm font-medium">
          <a className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-3 text-blue-700" href="#">
            <LayoutDashboard size={18} /> Dashboard
          </a>
          <button onClick={openForm} className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-500 hover:bg-slate-50">
            <PackagePlus size={18} /> Nieuwe advertentie
          </button>
        </nav>
      </aside>

      <main className="lg:ml-64">
        <header className="border-b border-slate-200 bg-white px-6 py-5 sm:px-10">
          <p className="text-sm font-medium text-blue-600">{showForm ? "Nieuwe advertentie" : "Overzicht"}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{showForm ? "Advertentie toevoegen" : "Jouw LEGO advertenties"}</h1>
        </header>
        <div className="mx-auto max-w-7xl space-y-8 p-6 sm:p-10">
          <section className="grid gap-4 md:grid-cols-3">
            {metrics.map(({ label, value, icon: Icon }) => (
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={label}>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">{label}</p>
                  <Icon className="text-blue-600" size={20} />
                </div>
                <p className="mt-4 text-3xl font-bold">{value}</p>
              </article>
            ))}
          </section>
          {showForm ? (
            <form onSubmit={submitListing} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <button type="button" onClick={() => setShowForm(false)} className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900">
                <ArrowLeft size={16} /> Terug naar dashboard
              </button>
              <div className="grid gap-6 lg:grid-cols-2">
                <label className="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-blue-400">
                  <ImagePlus className="mx-auto text-blue-600" size={30} />
                  <span className="mt-3 block font-semibold">Foto&apos;s toevoegen</span>
                  <span className="mt-1 block text-sm text-slate-500">1 tot 20 JPG, PNG of WebP-bestanden</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotos} className="sr-only" />
                  {photos.length > 0 && <span className="mt-4 block text-sm font-medium text-blue-700">{photos.length} foto&apos;s geselecteerd</span>}
                </label>
                <div className="space-y-4">
                  <input name="set_number" placeholder="Setnummer (bijv. 75192)" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                  <input name="set_name" placeholder="Setnaam (optioneel)" className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500" />
                  <select name="condition" defaultValue="used" className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                    <option value="new">Nieuw</option><option value="excellent">Uitstekend</option><option value="good">Goed</option><option value="used">Gebruikt</option>
                  </select>
                  <label className="flex items-center gap-3 text-sm"><input name="is_complete" type="checkbox" value="true" className="h-4 w-4 accent-blue-600" /> Compleet</label>
                  <label className="flex items-center gap-3 text-sm"><input name="has_box" type="checkbox" value="true" className="h-4 w-4 accent-blue-600" /> Doos aanwezig</label>
                  <label className="flex items-center gap-3 text-sm"><input name="has_manual" type="checkbox" value="true" className="h-4 w-4 accent-blue-600" /> Handleiding aanwezig</label>
                </div>
              </div>
              {message && <p className={`mt-5 text-sm ${message.includes("opgeslagen") ? "text-emerald-600" : "text-red-600"}`}>{message}</p>}
              <button disabled={saving} type="submit" className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {saving ? "Opslaan..." : "Advertentie opslaan"}
              </button>
            </form>
          ) : <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600">
              <PackagePlus size={26} />
            </div>
            <h2 className="mt-5 text-xl font-semibold">Maak je eerste advertentie</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Upload 1 tot 20 foto&apos;s. LegoSell AI herkent de set en maakt teksten voor beide platforms.
            </p>
            <button onClick={openForm} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
              Nieuwe advertentie
            </button>
          </section>}
        </div>
      </main>
    </div>
  );
}
