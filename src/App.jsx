import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/pages/Layout";
import Arcade from "@/pages/Arcade";
import MosquitoInvaders from "@/pages/MosquitoInvaders";
import PiranhaPage from "@/pages/PiranhaPage";
import BrawlPage from "@/pages/BrawlPage";

/**
 * The arcade shell. "/" is the floor; each game gets its own route so a cabinet
 * can be linked to directly. `basename` follows Vite's base, so this works both
 * at localhost and under the /mosquito-invaders/ Pages path.
 */
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Layout>
        <Routes>
          <Route path="/" element={<Arcade />} />
          <Route path="/mosquito-invaders" element={<MosquitoInvaders />} />
          <Route path="/piranha" element={<PiranhaPage />} />
          <Route path="/brawl" element={<BrawlPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
