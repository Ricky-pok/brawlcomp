"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import type { BfMap } from "@/lib/brawlify";

export default function MapSearch({ maps }: { maps: BfMap[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return maps;
    return maps.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.gameMode.name.toLowerCase().includes(q)
    );
  }, [query, maps]);

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-8">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">
          🔍
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search map or game mode..."
          className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-12 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors text-lg"
          autoFocus
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-gray-500 text-sm mb-4">
        {filtered.length} map{filtered.length !== 1 ? "s" : ""} found
      </p>

      {/* Map grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-600">
          <p className="text-5xl mb-3">🗺️</p>
          <p className="text-lg">No maps found for &quot;{query}&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((map) => (
            <div
              key={map.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-yellow-500/50 hover:scale-[1.02] transition-all duration-200"
            >
              {/* Map image */}
              <div className="relative w-full aspect-square bg-gray-800">
                <Image
                  src={map.imageUrl}
                  alt={map.name}
                  fill
                  className="object-contain p-2"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                />
              </div>

              {/* Map info */}
              <div className="p-4">
                <h3 className="font-bold text-white text-base leading-tight">
                  {map.name}
                </h3>
                <div className="flex items-center gap-2 mt-2">
                  <div className="relative w-5 h-5 shrink-0">
                    <Image
                      src={map.gameMode.imageUrl}
                      alt={map.gameMode.name}
                      fill
                      className="object-contain"
                      sizes="20px"
                    />
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: map.gameMode.color ?? "#aaa" }}
                  >
                    {map.gameMode.name}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
