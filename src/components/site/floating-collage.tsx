"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { Picture } from "@/components/ui/picture";
import type { PhotoView } from "@/lib/photos";

type Item = { view: PhotoView; slug: string; title: string };

/** Posições da composição (em % do palco) e velocidade de paralaxe de cada peça. */
const SLOTS = [
  { top: 4, left: 2, w: 24, z: 2, speed: -60 },
  { top: 14, left: 26, w: 22, z: 3, speed: 40 },
  { top: 30, left: 41, w: 27, z: 4, speed: -30 },
  { top: 2, left: 64, w: 20, z: 2, speed: 70 },
  { top: 52, left: 70, w: 26, z: 5, speed: -50 },
  { top: 56, left: 10, w: 23, z: 3, speed: 50 },
  { top: 64, left: 37, w: 18, z: 6, speed: -80 },
];

function Piece({ item, slot, progress, reduce }: { item: Item; slot: (typeof SLOTS)[number]; progress: MotionValue<number>; reduce: boolean }) {
  const y = useTransform(progress, [0, 1], reduce ? [0, 0] : [slot.speed, -slot.speed]);
  return (
    <motion.div
      style={{ top: `${slot.top}%`, left: `${slot.left}%`, width: `${slot.w}%`, zIndex: slot.z, y }}
      className="absolute"
    >
      <Link
        href={`/portfolio/${item.slug}`}
        className="group block shadow-[0_24px_60px_-28px_rgba(9,9,13,0.45)] transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] hover:z-10 hover:-translate-y-2 hover:scale-[1.03]"
      >
        <Picture photo={item.view} sizes="28vw" />
        <span className="absolute inset-x-0 bottom-0 translate-y-1 bg-gradient-to-t from-black/80 to-transparent p-3 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-white opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
          {item.title}
        </span>
      </Link>
    </motion.div>
  );
}

export function FloatingCollage({ items }: { items: Item[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = !!useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const pieces = items.slice(0, SLOTS.length);

  return (
    <>
      {/* desktop: colagem sobreposta com paralaxe */}
      <div ref={ref} className="relative mx-auto hidden h-[min(110vh,1100px)] max-w-[1600px] md:block">
        {pieces.map((item, i) => (
          <Piece key={item.view.id} item={item} slot={SLOTS[i]} progress={scrollYProgress} reduce={reduce} />
        ))}
      </div>
      {/* celular: grade limpa */}
      <ul className="grid grid-cols-2 gap-3 px-5 md:hidden">
        {pieces.slice(0, 6).map((item, i) => (
          <li key={item.view.id} className={i % 3 === 0 ? "col-span-2" : ""}>
            <Link href={`/portfolio/${item.slug}`} className="block">
              <Picture photo={item.view} sizes={i % 3 === 0 ? "100vw" : "50vw"} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
