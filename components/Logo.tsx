import Image from "next/image";

// The House of Abhinandan Lodha wordmark: white on transparent, for the
// app's dark brand background.
export function Logo({ className = "h-10", priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/hoabl-logo.png"
      alt="The House of Abhinandan Lodha"
      width={323}
      height={176}
      priority={priority}
      className={`w-auto ${className}`}
    />
  );
}
