import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";

/**
 * Only one route: the public game. `basename` follows Vite's base, so the app
 * works both at localhost:5173/ and under the /mosquito-invaders/ Pages path.
 */
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
