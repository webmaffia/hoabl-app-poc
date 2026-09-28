"use client";

// Name, mobile, city, then a mock OTP. The code is fixed and fills itself
// after 1.2s. While the customer is on the OTP step the live avatar warms up,
// so the advisor is ready by the time they land on it.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "@/lib/store";
import { avatar } from "@/lib/avatar/controller";
import { ArrowIcon, BackIcon } from "@/components/icons";
import { Logo } from "@/components/Logo";

const OTP = "481902";
const CITIES = ["Mumbai", "Pune", "Thane", "Navi Mumbai", "Bengaluru", "Delhi NCR", "Hyderabad", "Other"];

export default function Register() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "otp">("details");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [city, setCity] = useState("Mumbai");
  const [code, setCode] = useState("");
  const [autofilled, setAutofilled] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);

  const mobileOk = /^[6-9]\d{9}$/.test(mobile);
  const detailsOk = name.trim().length >= 2 && mobileOk;

  useEffect(() => {
    firstInput.current?.focus();
  }, []);

  useEffect(() => {
    if (step !== "otp") return;
    void avatar.warm();
    const t = setTimeout(() => {
      setCode(OTP);
      setAutofilled(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [step]);

  const verify = () => {
    if (code !== OTP) return;
    const session = useSession.getState();
    session.reset();
    session.setCustomer(name.trim(), city);
    router.push("/agent");
  };

  return (
    <main className="flex min-h-full flex-col px-6 pb-8 pt-5">
      <header className="flex items-center gap-3">
        {step === "otp" ? (
          <button onClick={() => setStep("details")} className="-ml-2 rounded-full p-2 text-ink-soft" aria-label="Back">
            <BackIcon className="h-5 w-5" />
          </button>
        ) : (
          <Link href="/" className="-ml-2 rounded-full p-2 text-ink-soft" aria-label="Back">
            <BackIcon className="h-5 w-5" />
          </Link>
        )}
        <div className="flex gap-1.5">
          <span className="h-1 w-8 rounded-full bg-verd" />
          <span className={`h-1 w-8 rounded-full ${step === "otp" ? "bg-verd" : "bg-line"}`} />
        </div>
        <Logo className="ml-auto h-9" />
      </header>

      {step === "details" ? (
        <form
          className="mt-8 flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (detailsOk) setStep("otp");
          }}
        >
          <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight">Let&rsquo;s get you started</h1>
          <p className="mt-2 text-[15px] text-ink-soft">Your advisor will use your name, and a code confirms your number.</p>

          <label className="mt-8 block text-[13px] font-medium text-ink-soft">
            Full name
            <input
              ref={firstInput}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Your full name"
              className="mt-1.5 h-13 w-full rounded-xl border border-line bg-card px-4 text-[16px] text-ink outline-none focus:border-verd"
            />
          </label>

          <label className="mt-4 block text-[13px] font-medium text-ink-soft">
            Mobile number
            <div className="mt-1.5 flex h-13 items-center rounded-xl border border-line bg-card focus-within:border-verd">
              <span className="border-r border-line px-3.5 text-[16px] text-ink-soft">+91</span>
              <input
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="98765 43210"
                className="h-full w-full rounded-r-xl bg-transparent px-3.5 text-[16px] text-ink outline-none"
              />
            </div>
            {mobile.length === 10 && !mobileOk && <span className="mt-1 block text-[12px] text-danger">Enter a valid Indian mobile number.</span>}
          </label>

          <label className="mt-4 block text-[13px] font-medium text-ink-soft">
            City
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1.5 h-13 w-full appearance-none rounded-xl border border-line bg-card px-4 text-[16px] text-ink outline-none focus:border-verd"
            >
              {CITIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={!detailsOk}
            className="mt-auto flex h-14 items-center justify-between rounded-2xl bg-gold px-5 font-semibold text-site transition disabled:opacity-40"
          >
            Send code
            <ArrowIcon className="h-5 w-5" />
          </button>
        </form>
      ) : (
        <form
          className="mt-8 flex flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            verify();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-[30px] font-semibold leading-tight tracking-tight">Enter the code</h1>
            <SandboxTag />
          </div>
          <p className="mt-2 text-[15px] text-ink-soft">
            Sent to +91 {mobile.slice(0, 5)} {mobile.slice(5)}
          </p>

          <label className="relative mt-8 block">
            <span className="sr-only">One-time code</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              className="absolute inset-0 opacity-0"
            />
            <div className="grid grid-cols-6 gap-2" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className={`flex h-14 items-center justify-center rounded-xl border bg-card font-display text-2xl font-semibold ${
                    code[i] ? "border-verd text-ink" : "border-line text-ink-soft"
                  }`}
                >
                  {code[i] ?? ""}
                </div>
              ))}
            </div>
          </label>

          <p className={`mt-4 rounded-xl bg-gold-soft px-3.5 py-2.5 text-[13px] text-ink transition-opacity ${autofilled ? "opacity-100" : "opacity-0"}`}>
            Prototype: the code was filled in automatically. No SMS is sent.
          </p>

          <p className="mt-6 text-[13px] leading-relaxed text-ink-soft">
            Your advisor is getting ready while you verify.
          </p>

          <button
            type="submit"
            disabled={code !== OTP}
            className="mt-auto flex h-14 items-center justify-between rounded-2xl bg-gold px-5 font-semibold text-site transition disabled:opacity-40"
          >
            Verify and meet your advisor
            <ArrowIcon className="h-5 w-5" />
          </button>
        </form>
      )}
    </main>
  );
}

function SandboxTag() {
  return (
    <span className="mt-2 shrink-0 rounded-full border border-gold px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
      Sandbox
    </span>
  );
}
