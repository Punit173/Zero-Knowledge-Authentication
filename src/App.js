import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ZeroKnowledgeAuth from "./ZeroKnowledgeAuth";
import Checkout from "./Checkout";
import Cancel from "./Cancel";

function App() {
  return (
      <Routes>
        <Route path="/" element={<ZeroKnowledgeAuth />} />
        <Route path="/paymentgateway" element={<Checkout />} />
        <Route path="/cancel" element={<Cancel />} />
        
      </Routes>
  );
}

export default App;
