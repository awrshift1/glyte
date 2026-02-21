"use client";

import Image from "next/image";

const links = [
  { label: "GitHub", href: "https://github.com/awrshift1/glyte" },
  { label: "Documentation", href: "#" },
  { label: "Changelog", href: "#" },
];

export default function Footer() {
  return (
    <footer className="border-t border-[#334155] px-6 md:px-16 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Image
              src="/images/mascot/v3-01-idle.png"
              alt="Glyte mascot"
              width={32}
              height={32}
            />
            <span className="font-bold text-white text-lg">Glyte</span>
          </div>

          <nav className="flex items-center gap-6">
            {links.map((link, i) => (
              <a
                key={i}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={
                  link.href.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
                className="text-sm text-[#94a3b8] hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <p className="text-sm text-[#64748b]">
            Built with Next.js, DuckDB, and Claude.
          </p>
        </div>

        <div className="flex items-center justify-between mt-6 pt-6 border-t border-[#334155]/50">
          <span className="text-xs text-[#64748b]">MIT License</span>
          <span className="text-xs text-[#64748b]">2026</span>
        </div>
      </div>
    </footer>
  );
}
