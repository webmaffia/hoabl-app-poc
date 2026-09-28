"use client";

// KYC, simulated: PAN with format validation, Aadhaar e-KYC by consent (the
// Aadhaar number is never asked for or stored), date of birth, address, a
// liveness check and a verdict. Only a masked PAN is kept in the session.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/store";
import { yearsSince } from "@/lib/journey";
import { Button, Card, Field, SandboxTag, ScreenTitle, Steps, inputClass } from "@/components/journey/ui";

const PAN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
type Step = "pan" | "aadhaar" | "address" | "liveness" | "done";
const ORDER: Step[] = ["pan", "aadhaar", "address", "liveness", "done"];

export default function Kyc() {
  const router = useRouter();
  const { profile, kyc, booking, setKyc, sendEvent } = useSession();
  const [step, setStep] = useState<Step>(kyc ? "done" : "pan");
  const [pan, setPan] = useState("");
  const [name, setName] = useState(profile.name ?? "");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [line, setLine] = useState("");
  const [pin, setPin] = useState("");
  const [scan, setScan] = useState(0);

  const panOk = PAN.test(pan);
  const age = yearsSince(dob);
  const dobOk = age !== null && age >= 18 && age < 100;

  // Liveness: a short scripted scan, then the verdict.
  useEffect(() => {
    if (step !== "liveness") return;
    const timers = [1, 2, 3].map((i) => setTimeout(() => setScan(i), i * 1000));
    timers.push(
      setTimeout(() => {
        const masked = `${pan.slice(0, 3)}••••${pan.slice(-2)}`;
        setKyc({ panMasked: masked, name: name.trim(), verifiedAt: Date.now() });
        setStep("done");
        void sendEvent(
          "KYC verified",
          `The customer completed KYC${booking ? ` for booking ${booking.booking_id}` : ""}: PAN format valid, Aadhaar e-KYC by consent, address and liveness all verified (simulated).`,
          "kyc_completed",
        );
      }, 3600),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const idx = ORDER.indexOf(step);

  return (
    <div>
      <ScreenTitle eyebrow="Verify your identity" title={step === "done" ? "KYC complete" : "Quick KYC"} sub="Takes about two minutes." right={<SandboxTag />} />
      <Steps current={idx + 1} total={ORDER.length} />

      {step === "pan" && (
        <form
          className="mt-5 space-y-4 px-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (panOk && dobOk && name.trim().length > 1) setStep("aadhaar");
          }}
        >
          <Field label="PAN" error={pan.length === 10 && !panOk ? "PAN looks like ABCDE1234F: five letters, four digits, one letter." : null} hint="Five letters, four digits, one letter.">
            <input
              value={pan}
              onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
              placeholder="ABCDE1234F"
              autoCapitalize="characters"
              className={`${inputClass} font-semibold tracking-[0.2em]`}
            />
          </Field>
          <Field label="Name as on PAN">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoComplete="name" />
          </Field>
          <Field label="Date of birth" error={dob && !dobOk ? "You need to be 18 or older." : null}>
            <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className={inputClass} />
          </Field>
          <Button type="submit" className="w-full" disabled={!panOk || !dobOk || name.trim().length < 2}>
            Continue
          </Button>
        </form>
      )}

      {step === "aadhaar" && (
        <div className="mt-5 px-4">
          <Card className="px-4 py-4">
            <div className="text-[15px] font-semibold">Aadhaar e-KYC via DigiLocker</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
              We fetch your name, photo and address from DigiLocker with your consent. We never ask for or store your Aadhaar number.
            </p>
            <label className="mt-3 flex items-start gap-2.5 text-[13px] leading-snug">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--verd)]" />
              I consent to HoABL fetching my Aadhaar e-KYC details from DigiLocker for this booking.
            </label>
          </Card>
          <Button
            className="mt-4 w-full"
            disabled={!consent || fetching}
            onClick={() => {
              setFetching(true);
              setTimeout(() => {
                setFetching(false);
                setStep("address");
              }, 1500);
            }}
          >
            {fetching ? "Connecting to DigiLocker…" : "Continue with DigiLocker · simulated"}
          </Button>
        </div>
      )}

      {step === "address" && (
        <form
          className="mt-5 space-y-4 px-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (line.trim().length > 4 && /^\d{6}$/.test(pin)) setStep("liveness");
          }}
        >
          <p className="rounded-xl bg-verd-soft px-3 py-2 text-[12.5px] text-verd">Aadhaar e-KYC received. Confirm your current address.</p>
          <Field label="Address">
            <input value={line} onChange={(e) => setLine(e.target.value)} placeholder="Flat, building, street" className={inputClass} autoComplete="street-address" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input defaultValue={profile.city ?? ""} className={inputClass} autoComplete="address-level2" />
            </Field>
            <Field label="PIN code" error={pin.length === 6 || pin.length === 0 ? null : "Six digits"}>
              <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" className={inputClass} autoComplete="postal-code" />
            </Field>
          </div>
          <Button type="submit" className="w-full" disabled={line.trim().length < 5 || !/^\d{6}$/.test(pin)}>
            Continue to selfie check
          </Button>
        </form>
      )}

      {step === "liveness" && (
        <div className="mt-6 flex flex-col items-center px-4 text-center">
          <div className="relative flex h-52 w-44 items-center justify-center overflow-hidden rounded-[48%] border-4 border-verd bg-site">
            <svg viewBox="0 0 100 120" className="h-40 text-site-ink/50" aria-hidden="true">
              <ellipse cx="50" cy="52" rx="28" ry="34" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
              <path d="M20 118 C24 92 38 86 50 86 C62 86 76 92 80 118" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
            </svg>
            <div className="absolute inset-x-0 h-1 bg-[#d6a24a] shadow-[0_0_16px_4px_rgba(214,162,74,0.6)]" style={{ top: `${15 + (scan % 2) * 70}%`, transition: "top 1s ease-in-out" }} />
          </div>
          <p className="mt-4 text-[15px] font-semibold">{["Hold your phone at eye level", "Blink twice", "Turn slightly left", "Checking…"][scan]}</p>
          <p className="text-[12px] text-ink-soft">Simulated liveness check. The camera isn&rsquo;t used.</p>
        </div>
      )}

      {step === "done" && (
        <div className="mt-5 px-4">
          <Card className="divide-y divide-line">
            {[
              ["PAN", kyc?.panMasked ?? "Verified"],
              ["Name match", kyc?.name ?? name],
              ["Aadhaar e-KYC", "Received via DigiLocker"],
              ["Address", "Confirmed"],
              ["Liveness", "Passed"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between px-4 py-2.5 text-[13.5px]">
                <span className="text-ink-soft">{k}</span>
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="text-verd">✓</span>
                  {v}
                </span>
              </div>
            ))}
          </Card>
          <Button className="mt-4 w-full" onClick={() => router.push("/money/loan")}>
            Check loan eligibility
          </Button>
          <p className="mt-3 text-center text-[11.5px] text-ink-soft">Sandbox verdict. No identity documents were checked.</p>
        </div>
      )}
    </div>
  );
}
