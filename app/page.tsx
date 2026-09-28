import { Logo } from "@/components/Logo";
import { Slideshow, type Slide } from "@/components/Slideshow";
import { ResumeCta } from "@/components/ResumeCta";

// Real amenity photography from the sample project. The app covers HoABL's
// whole portfolio; Isle of Anjarle is the featured example.
const SLIDES: Slide[] = [
  { src: "/projects/anjarle/amenities/sunset-point.jpg", alt: "Sunset point", caption: "Sunset point · Isle of Anjarle" },
  { src: "/projects/anjarle/amenities/clubhouse01.jpg", alt: "Clubhouse", caption: "Clifftop clubhouse · Isle of Anjarle" },
  { src: "/projects/anjarle/amenities/open-air-cafe.jpg", alt: "Open-air café", caption: "Open-air café · Isle of Anjarle" },
  { src: "/projects/anjarle/amenities/entrance-gate.jpg", alt: "Grand entrance", caption: "Grand entrance · Isle of Anjarle" },
  { src: "/projects/anjarle/amenities/hammock.jpg", alt: "Hammock garden", caption: "Hammock garden · Isle of Anjarle" },
  { src: "/projects/anjarle/amenities/stargazing-and-bornfire.jpg", alt: "Stargazing and bonfire", caption: "Stargazing deck · Isle of Anjarle" },
  { src: "/projects/anjarle/amenities/swinging-pavilion.jpg", alt: "Swinging pavilion", caption: "Swinging pavilion · Isle of Anjarle" },
  { src: "/projects/anjarle/amenities/amphitheatre-guest-rooms-zip-line.jpg", alt: "Amphitheatre", caption: "Amphitheatre · Isle of Anjarle" },
];

export default function Landing() {
  return (
    <main className="relative flex min-h-full flex-col overflow-hidden bg-site text-white">
      <Slideshow slides={SLIDES} />
      {/* Scrims keep the logo and copy legible over any photo. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/90" />

      <header className="relative z-10 flex items-start justify-between px-6 pt-6">
        <Logo className="h-14" priority />
        <span className="rounded-full border border-white/35 bg-black/20 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/85 backdrop-blur">
          Prototype
        </span>
      </header>

      <section className="relative z-10 mt-auto px-6 pb-4">
        <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em] text-[#f0c27a] [text-shadow:0_1px_6px_rgb(0_0_0/0.6)]">Land Advisor</p>
        <h1 className="font-display text-[38px] font-semibold leading-[1.04] tracking-tight [text-shadow:0_2px_12px_rgb(0_0_0/0.35)]">
          Find land worth owning, in one conversation.
        </h1>
        <p className="mt-4 max-w-[36ch] text-[15px] leading-relaxed text-white/90 [text-shadow:0_1px_6px_rgb(0_0_0/0.5)]">
          Tell our Land Advisor what you&rsquo;re looking for. It knows every HoABL project, plot and price, shows you what fits, and can hold a
          plot for you when you&rsquo;re ready.
        </p>
      </section>

      <section className="relative z-10 px-6 pb-8 pt-4">
        <ResumeCta />
        <p className="mt-4 text-center text-[12px] leading-relaxed text-white/65">
          You&rsquo;ll be speaking with HoABL&rsquo;s virtual Land Advisor. OTP, payment, KYC and loan steps are simulated in this prototype.
        </p>
        <p className="mt-2 text-center text-[12px]">
          <a href="/console" target="_blank" rel="noreferrer" className="font-semibold text-white/70 underline underline-offset-2">
            Presenter console
          </a>
        </p>
      </section>
    </main>
  );
}
